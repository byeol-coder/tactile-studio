// EditorStore's crash-recovery autosave wiring (scheduleSessionAutosave /
// checkForRecoverableSession / restoreSession / dismissRecovery / dispose).
// Pure logic against a fake SessionRecoveryAdapterLike -- no React, no DOM,
// no real localStorage. See tests/parity/session-recovery-storage-adapter.test.ts
// for the real adapter's own I/O behavior, and
// tests/parity/session-snapshot-codec.test.ts for the codec's parity against
// the shipped monolith.
import { describe, it, expect, vi } from 'vitest';
import { EditorStore, type SessionRecoveryAdapterLike } from '../../src/core/state/editor-store.js';
import { createDocument } from '../../src/core/document/document.js';
import type { ParsedSessionSnapshot } from '../../src/codecs/document/session-snapshot.js';

function makeFakeSnapshot(overrides: Partial<ParsedSessionSnapshot> = {}): ParsedSessionSnapshot {
  const cells = new Uint8Array(2400);
  cells[3] = 1;
  return {
    v: 1, savedAt: 123, gridW: 60, gridH: 40, output: '60', pageIndex: 0,
    fileName: 'recovered', brailleLang: 'ko-g1', pages: ['x'], audio: {}, vectors: {},
    liveCells: [cells],
    ...overrides,
  };
}

function makeFakeAdapter(overrides: Partial<SessionRecoveryAdapterLike> = {}): SessionRecoveryAdapterLike & {
  save: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>;
} {
  return {
    load: vi.fn(async () => null),
    save: vi.fn(async () => true),
    clear: vi.fn(async () => {}),
    ...overrides,
  } as any;
}

describe('EditorStore — crash-recovery autosave (no adapter provided)', () => {
  it('is a complete no-op: no scheduling, checkForRecoverableSession resolves false, recoverOffer stays false', async () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    expect(await store.checkForRecoverableSession()).toBe(false);
    expect(store.getSnapshot().recoverOffer).toBe(false);
    // dispose()/restoreSession()/dismissRecovery() must all be safe no-ops too
    expect(() => store.dispose()).not.toThrow();
    store.restoreSession('recovered');
    await store.dismissRecovery();
  });
});

describe('EditorStore — crash-recovery autosave (with adapter)', () => {
  it('schedules a debounced save 800ms after a dirty-marking mutation, and reschedules on further edits', () => {
    vi.useFakeTimers();
    const adapter = makeFakeAdapter();
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });

    store.mutateActiveCells((cells) => { cells[0] = 1; });
    vi.advanceTimersByTime(500);
    expect(adapter.save).not.toHaveBeenCalled(); // not yet — still within the debounce window

    store.mutateActiveCells((cells) => { cells[1] = 1; }); // edit again — resets the 800ms window
    vi.advanceTimersByTime(500);
    expect(adapter.save).not.toHaveBeenCalled(); // would have fired by now if the timer hadn't reset

    vi.advanceTimersByTime(300);
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(store.getDocument(), { brailleLang: 'ko-g2' });

    vi.useRealTimers();
  });

  it('checkForRecoverableSession loads via the adapter, sets recoverOffer, and exposes the pending snapshot to restoreSession', async () => {
    const snap = makeFakeSnapshot({ fileName: '복구된 문서', pageIndex: 0 });
    const adapter = makeFakeAdapter({ load: vi.fn(async () => snap) });
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });

    const found = await store.checkForRecoverableSession();
    expect(found).toBe(true);
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().recoverOffer).toBe(true);

    store.restoreSession('Previous session restored.');
    const s = store.getSnapshot();
    expect(s.recoverOffer).toBe(false);
    expect(s.dirty).toBe(false);
    expect(s.announce).toBe('Previous session restored.');
    expect(store.getDocument().title).toBe('복구된 문서');
    expect(Array.from(store.getActiveCells())).toEqual(Array.from(snap.liveCells[0]));
  });

  it('checkForRecoverableSession resolves false and leaves recoverOffer false when the adapter finds nothing', async () => {
    const adapter = makeFakeAdapter({ load: vi.fn(async () => null) });
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });
    expect(await store.checkForRecoverableSession()).toBe(false);
    expect(store.getSnapshot().recoverOffer).toBe(false);
  });

  it('autosave never overwrites a pending, unanswered recovery snapshot (mirrors the monolith\'s guard)', async () => {
    vi.useFakeTimers();
    const snap = makeFakeSnapshot();
    const adapter = makeFakeAdapter({ load: vi.fn(async () => snap) });
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });

    await store.checkForRecoverableSession(); // recoverOffer now true, pending unanswered
    store.mutateActiveCells((cells) => { cells[0] = 1; }); // e.g. an edit somehow racing the banner
    vi.advanceTimersByTime(1000);
    expect(adapter.save).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('dismissRecovery clears recoverOffer and calls adapter.clear(), and re-enables autosave scheduling', async () => {
    vi.useFakeTimers();
    const snap = makeFakeSnapshot();
    const adapter = makeFakeAdapter({ load: vi.fn(async () => snap) });
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });

    await store.checkForRecoverableSession();
    await store.dismissRecovery();
    expect(adapter.clear).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().recoverOffer).toBe(false);

    store.mutateActiveCells((cells) => { cells[0] = 1; });
    vi.advanceTimersByTime(800);
    expect(adapter.save).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('dispose() cancels a pending debounced autosave', () => {
    vi.useFakeTimers();
    const adapter = makeFakeAdapter();
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    store.dispose();
    vi.advanceTimersByTime(2000);
    expect(adapter.save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('restoreSession() is a no-op if there is no pending snapshot', () => {
    const adapter = makeFakeAdapter();
    const store = new EditorStore(createDocument('doc', 60, 40), { sessionRecovery: adapter });
    const before = store.getDocument();
    store.restoreSession('should not announce');
    expect(store.getDocument()).toBe(before);
    expect(store.getSnapshot().announce).toBe('');
  });
});

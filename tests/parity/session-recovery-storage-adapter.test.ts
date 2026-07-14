// Tests for src/storage/adapters/session-recovery-storage-adapter.ts against
// a fake window.localStorage (a real Map-backed Web Storage implementation,
// not a mock of our own adapter). See tests/parity/session-snapshot-codec.test.ts
// for byte-for-byte parity of the underlying codec against the shipped
// monolith methods -- this file covers the ADAPTER's I/O/error-handling
// contract, which (per the codec's doc comment) is intentionally NOT a
// verbatim port of a pre-existing bug, since there is no earlier shipped
// version of this feature in this branch.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionRecoveryStorageAdapter, SESSION_RECOVERY_KEY,
} from '../../src/storage/adapters/session-recovery-storage-adapter.js';
import { createDocument } from '../../src/core/document/document.js';
import type { StudioDocument } from '../../src/core/types.js';

function makeFakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
}

function docWithOneDot(): StudioDocument {
  const doc = createDocument('my-doc', 60, 40);
  doc.pages[0][7] = 1;
  return doc;
}

describe('SessionRecoveryStorageAdapter (fake window.localStorage)', () => {
  beforeEach(() => {
    (globalThis as any).window = { localStorage: makeFakeLocalStorage() };
  });

  it('load() on empty storage resolves null', async () => {
    const adapter = createSessionRecoveryStorageAdapter();
    expect(await adapter.load()).toBeNull();
  });

  it('save() then load() round-trips a recoverable document', async () => {
    const adapter = createSessionRecoveryStorageAdapter();
    const doc = docWithOneDot();
    await expect(adapter.save(doc, { brailleLang: 'ko-g1' })).resolves.toBe(true);
    expect(window.localStorage.getItem(SESSION_RECOVERY_KEY)).toBeTruthy();

    const loaded = await adapter.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.gridW).toBe(60);
    expect(loaded!.gridH).toBe(40);
    expect(loaded!.brailleLang).toBe('ko-g1');
    expect(Array.from(loaded!.liveCells[0])).toEqual(Array.from(doc.pages[0]));
  });

  it('save() with no recoverable content clears any existing snapshot instead of writing a new one', async () => {
    const adapter = createSessionRecoveryStorageAdapter();
    const doc = docWithOneDot();
    await adapter.save(doc, { brailleLang: 'ko-g2' });
    expect(window.localStorage.getItem(SESSION_RECOVERY_KEY)).toBeTruthy();

    const emptyDoc = createDocument('empty', 60, 40); // single blank page, no audio
    await expect(adapter.save(emptyDoc, { brailleLang: 'ko-g2' })).resolves.toBe(true);
    expect(window.localStorage.getItem(SESSION_RECOVERY_KEY)).toBeNull();
    expect(await adapter.load()).toBeNull();
  });

  it('clear() removes the stored snapshot and never throws', async () => {
    const adapter = createSessionRecoveryStorageAdapter();
    await adapter.save(docWithOneDot(), { brailleLang: 'ko-g2' });
    expect(window.localStorage.getItem(SESSION_RECOVERY_KEY)).toBeTruthy();
    await adapter.clear();
    expect(window.localStorage.getItem(SESSION_RECOVERY_KEY)).toBeNull();
  });

  it('reports failure (false) instead of swallowing it when storage throws on save', async () => {
    (globalThis as any).window.localStorage = {
      getItem() { throw new Error('quota'); },
      setItem() { throw new Error('quota'); },
      removeItem() { throw new Error('quota'); },
    };
    const adapter = createSessionRecoveryStorageAdapter();
    await expect(adapter.save(docWithOneDot(), { brailleLang: 'ko-g2' })).resolves.toBe(false);
    await expect(adapter.load()).resolves.toBeNull();
    await expect(adapter.clear()).resolves.toBeUndefined(); // clear() never throws, matches monolith's _dismissRecover
  });

  it('is a no-op (never throws) when window/localStorage is unavailable (SSR / dev shell without DOM)', async () => {
    (globalThis as any).window = undefined;
    const adapter = createSessionRecoveryStorageAdapter();
    await expect(adapter.load()).resolves.toBeNull();
    await expect(adapter.save(docWithOneDot(), { brailleLang: 'ko-g2' })).resolves.toBe(false);
    await expect(adapter.clear()).resolves.toBeUndefined();
  });

  it('load() rejects (resolves null for) malformed / trivial-content snapshots stored out of band', async () => {
    const adapter = createSessionRecoveryStorageAdapter();
    window.localStorage.setItem(SESSION_RECOVERY_KEY, 'not json');
    expect(await adapter.load()).toBeNull();
  });
});

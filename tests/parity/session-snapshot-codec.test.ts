// Parity test for src/codecs/document/session-snapshot.ts against the real
// shipped monolith methods (_packCells/_unpackCells/_hasContent/
// _serializeSession/_loadSession), added to vanilla main in ecb67e3
// (2026-07-13) -- after this migration branch's fork point, so this is the
// first parity coverage for this feature in this branch (see
// docs/known-issues.md #7/#8 and the codec file's own doc comment).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadStudioClass, makeInstance, seededCells, patternCells } from '../../tools/harness.mjs';
import {
  packCells, unpackCells, hasRecoverableContent, serializeSessionSnapshot, parseSessionSnapshot,
} from '../../src/codecs/document/session-snapshot.js';

let Component: any;
let proto: any;
const FIXED_NOW = 1_752_400_000_000;

beforeAll(() => {
  ({ Component } = loadStudioClass({ fixedNow: FIXED_NOW }));
  proto = Component.prototype;
});

describe('session-snapshot codec parity', () => {
  it('packCells/unpackCells round-trip matches the shipped _packCells/_unpackCells exactly', () => {
    const w = 60, h = 40;
    const cases = [seededCells(w, h, 3), patternCells(w, h, 'all-on'), patternCells(w, h, 'all-off'), patternCells(w, h, 'checker')];
    const inst = makeInstance(Component);
    for (const cells of cases) {
      const extractedPacked = packCells(cells);
      const shippedPacked = proto._packCells.call(inst, cells);
      expect(extractedPacked).toBe(shippedPacked);

      const extractedUnpacked = unpackCells(extractedPacked, w * h);
      const shippedUnpacked = proto._unpackCells.call(inst, shippedPacked, w * h);
      expect(Array.from(extractedUnpacked)).toEqual(Array.from(shippedUnpacked));
      expect(Array.from(extractedUnpacked)).toEqual(Array.from(cells));
    }
  });

  it('hasRecoverableContent matches the shipped _hasContent across empty/single-dot/multi-page/audio-only cases', () => {
    const w = 60, h = 40;
    const empty = new Uint8Array(w * h);
    const oneDot = new Uint8Array(w * h); oneDot[5] = 1;

    const cases: Array<{ pages: Uint8Array[]; pageAudio: Record<number, any> }> = [
      { pages: [empty], pageAudio: {} },
      { pages: [oneDot], pageAudio: {} },
      { pages: [empty, empty], pageAudio: {} },
      { pages: [empty], pageAudio: { 0: { narration: 'hi' } } },
      { pages: [empty], pageAudio: { 0: { desc: 'a description' } } },
      { pages: [empty], pageAudio: { 0: { src: 'assets/audio/x.mp3' } } },
      { pages: [empty], pageAudio: { 0: { unrelated: true } } },
    ];
    for (const c of cases) {
      const inst = makeInstance(Component, { pages: c.pages, pageAudio: c.pageAudio });
      const extracted = hasRecoverableContent(c.pages, c.pageAudio);
      const shipped = proto._hasContent.call(inst);
      expect(extracted).toBe(shipped);
    }
  });

  it('serializeSessionSnapshot matches the shipped _serializeSession exactly (byte-for-byte JSON)', () => {
    const w = 60, h = 40;
    const page1 = seededCells(w, h, 11);
    const page2 = seededCells(w, h, 42);
    const inst = makeInstance(Component, {
      state: { gridW: w, gridH: h, output: '60', pageIndex: 1, fileName: '내 도면', brailleLang: 'ko-g1' },
      pages: [page1, page2],
      pageAudio: { 0: { desc: '설명', _url: 'blob:should-be-dropped' }, 1: { narration: 'narr' } },
      pageVectors: { 0: [{ type: 'line' }] },
    });

    const doc = {
      title: '내 도면',
      grid: { w, h },
      pages: [page1, page2],
      pageIndex: 1,
      pageAudio: { 0: { desc: '설명', _url: 'blob:should-be-dropped' }, 1: { narration: 'narr' } },
      pageVectors: { 0: [{ type: 'line' }] },
    };

    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const extracted = serializeSessionSnapshot(doc as any, { brailleLang: 'ko-g1' });
    const shipped = proto._serializeSession.call(inst);
    vi.restoreAllMocks();

    expect(JSON.stringify(extracted)).toBe(JSON.stringify(shipped));
    // explicitly confirm the _url stripping (the one non-trivial transform)
    expect((extracted.audio[0] as any)._url).toBeUndefined();
    expect((shipped.audio[0] as any)._url).toBeUndefined();
  });

  it('parseSessionSnapshot matches the shipped _loadSession: valid multi-page snapshot is accepted with unpacked cells', () => {
    const w = 60, h = 40;
    const page1 = seededCells(w, h, 5);
    const page2 = seededCells(w, h, 6);
    const raw = JSON.stringify({
      v: 1, savedAt: FIXED_NOW, gridW: w, gridH: h, output: '60', pageIndex: 1,
      fileName: 'f', brailleLang: 'ko-g2',
      pages: [packCells(page1), packCells(page2)],
      audio: {}, vectors: {},
    });

    const extracted = parseSessionSnapshot(raw);

    // Cross-check against the real shipped _loadSession, which reads via
    // window.localStorage.getItem('ts.session.v1') internally rather than
    // accepting a raw string — inject a fake localStorage into a fresh
    // sandboxed Component (same pattern as storage-adapters.test.ts's
    // saveLibrary/loadLibrary parity test).
    const fakeStorage = { getItem: (k: string) => (k === 'ts.session.v1' ? raw : null) };
    const { Component: ShippedComponent } = loadStudioClass({ fixedNow: FIXED_NOW, localStorage: fakeStorage });
    const shipped = ShippedComponent.prototype._loadSession.call(makeInstance(ShippedComponent));

    expect(extracted).not.toBeNull();
    expect(shipped).not.toBeNull();
    expect(extracted!.gridW).toBe(shipped.gridW);
    expect(extracted!.gridH).toBe(shipped.gridH);
    expect(extracted!.pageIndex).toBe(shipped.pageIndex);
    expect(extracted!.liveCells.length).toBe(shipped._pages.length);
    for (let i = 0; i < extracted!.liveCells.length; i++) {
      expect(Array.from(extracted!.liveCells[i])).toEqual(Array.from(shipped._pages[i]));
    }
    expect(Array.from(extracted!.liveCells[0])).toEqual(Array.from(page1));
    expect(Array.from(extracted!.liveCells[1])).toEqual(Array.from(page2));
  });

  it('parseSessionSnapshot rejects a trivial single-page all-zero snapshot with no audio (not "worth" recovering), matching the shipped gate', () => {
    const w = 60, h = 40;
    const inst = makeInstance(Component);
    const raw = JSON.stringify({
      v: 1, savedAt: FIXED_NOW, gridW: w, gridH: h, output: '60', pageIndex: 0,
      fileName: null, brailleLang: 'ko-g2',
      pages: [proto._packCells.call(inst, new Uint8Array(w * h))],
      audio: {}, vectors: {},
    });
    expect(parseSessionSnapshot(raw)).toBeNull();
  });

  it('parseSessionSnapshot rejects malformed JSON / missing pages, matching the shipped try/catch-and-null', () => {
    expect(parseSessionSnapshot('not json')).toBeNull();
    expect(parseSessionSnapshot('{}')).toBeNull();
    expect(parseSessionSnapshot(JSON.stringify({ pages: [] }))).toBeNull();
  });
});

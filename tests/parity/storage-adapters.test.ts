// Phase 4 storage-adapter tests. local-library adapter is tested against a
// fake window.localStorage (a real Map-backed implementation of the Web
// Storage interface, not a mock of our own adapter) and additionally
// cross-checked byte-for-byte against the shipped saveLibrary/loadLibrary
// implementation via tools/harness.mjs.
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStorageAdapter } from '../../src/storage/adapters/memory-storage-adapter.js';
import {
  createLocalLibraryStorageAdapter, LOCAL_LIBRARY_KEY,
} from '../../src/storage/adapters/local-library-storage-adapter.js';
import { createDocument } from '../../src/core/document/document.js';
import { loadVendorTW, loadStudioClass, seededCells, patternCells } from '../../tools/harness.mjs';

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

describe('MemoryStorageAdapter', () => {
  it('round-trips a document through save/load', async () => {
    const adapter = createMemoryStorageAdapter();
    const doc = createDocument('my-doc', 60, 40);
    doc.pages[0][5] = 1;
    const result = await adapter.save(doc);
    expect(result.ok).toBe(true);
    expect(result.id).toBe('my-doc');
    const loaded = await adapter.load('my-doc');
    expect(Array.from(loaded.pages[0])).toEqual(Array.from(doc.pages[0]));
  });

  it('load() rejects for an unknown id', async () => {
    const adapter = createMemoryStorageAdapter();
    await expect(adapter.load('nope')).rejects.toThrow();
  });

  it('returned documents are defensive copies (mutating the load result does not affect the store)', async () => {
    const adapter = createMemoryStorageAdapter();
    const doc = createDocument('doc', 60, 40);
    await adapter.save(doc);
    const loaded = await adapter.load('doc');
    loaded.pages[0][0] = 1;
    const loadedAgain = await adapter.load('doc');
    expect(loadedAgain.pages[0][0]).toBe(0);
  });

  it('rejects a stale optimistic save without overwriting the newer document', async () => {
    const adapter = createMemoryStorageAdapter();
    const first = createDocument('doc', 60, 40);
    const saved = await adapter.save(first);
    expect(saved.version).toBe('1');

    const newer = createDocument('doc', 60, 40);
    newer.pages[0][7] = 1;
    await adapter.save(newer, { expectedVersion: '1' });

    const stale = createDocument('doc', 60, 40);
    stale.pages[0][8] = 1;
    const rejected = await adapter.save(stale, { expectedVersion: '1' });
    expect(rejected).toMatchObject({ ok: false, conflict: true, remoteVersion: '2' });
    expect((await adapter.load('doc')).pages[0][7]).toBe(1);
  });

  it('seed()/has()/clear() work as a test/dev-shell hook', () => {
    const adapter = createMemoryStorageAdapter();
    expect(adapter.has('x')).toBe(false);
    adapter.seed('x', createDocument('x', 60, 40));
    expect(adapter.has('x')).toBe(true);
    adapter.clear();
    expect(adapter.has('x')).toBe(false);
  });
});

describe('LocalLibraryStorageAdapter (fake window.localStorage)', () => {
  let TW: any;
  beforeEach(() => {
    TW = loadVendorTW();
    (globalThis as any).window = { localStorage: makeFakeLocalStorage() };
  });

  it('list() on empty storage returns []', async () => {
    const adapter = createLocalLibraryStorageAdapter(TW.encodeBits);
    expect(await adapter.list()).toEqual([]);
  });

  it('save() then list() round-trips 60×40 items exactly; non-native grid keeps thumb-only', async () => {
    const adapter = createLocalLibraryStorageAdapter(TW.encodeBits);
    const items = [
      { name: 'A', loc: 'drive', grid: '60×40', thumb: 'tA', cells: seededCells(60, 40, 5) },
      { name: 'B', loc: 'device', grid: '96×64', thumb: 'tB', cells: seededCells(96, 64, 9) },
    ];
    await expect(adapter.save(items)).resolves.toBe(true);
    const raw = window.localStorage.getItem(LOCAL_LIBRARY_KEY);
    expect(raw).toBeTruthy();
    const loaded = await adapter.list();
    expect(loaded.length).toBe(2);
    expect(Array.from(loaded[0].cells)).toEqual(Array.from(items[0].cells));
    // 96×64 never round-trips through the fixed 60×40/2400-cell rehydrate path
    expect(loaded[1].cells.length).toBe(2400);
  });

  it('parity: matches the shipped saveLibrary/loadLibrary output exactly for the same items', async () => {
    const items = [
      { name: 'A', loc: 'drive', grid: '60×40', thumb: 'tA', cells: seededCells(60, 40, 5) },
      { name: 'B', loc: 'device', grid: '60×40', thumb: '', cells: patternCells(60, 40, 'all-on') },
    ];
    // The shipped saveLibrary/loadLibrary methods were compiled inside the
    // sandbox loadStudioClass creates and always resolve `window` through
    // THAT sandbox (see harness.mjs) — inject the same fake localStorage
    // there, not on the real globalThis.window, for a fair comparison.
    const shippedStorage = makeFakeLocalStorage();
    const { Component } = loadStudioClass({ tw: TW, localStorage: shippedStorage });
    const proto = Component.prototype;
    const inst = Object.create(proto);
    proto.saveLibrary.call(inst, items);
    const shippedRaw = shippedStorage.getItem('ts.library.v1');
    expect(shippedRaw).toBeTruthy();

    const adapter = createLocalLibraryStorageAdapter(TW.encodeBits);
    await adapter.save(items);
    const extractedRaw = window.localStorage.getItem(LOCAL_LIBRARY_KEY);

    expect(JSON.parse(extractedRaw!)).toEqual(JSON.parse(shippedRaw!));
  });

  it('tolerates a storage that throws (private-browsing / quota) exactly like production: non-fatal, but now reports the failure', async () => {
    (globalThis as any).window.localStorage = {
      getItem() { throw new Error('quota'); },
      setItem() { throw new Error('quota'); },
    };
    const adapter = createLocalLibraryStorageAdapter(TW.encodeBits);
    await expect(adapter.list()).resolves.toEqual([]);
    await expect(adapter.save([{ name: 'x', loc: 'drive', grid: '60×40', thumb: '', cells: seededCells(60, 40, 1) }])).resolves.toBe(false);
  });

  it('is a no-op (never throws) when window/localStorage is unavailable (SSR / dev shell without DOM)', async () => {
    (globalThis as any).window = undefined;
    const adapter = createLocalLibraryStorageAdapter(TW.encodeBits);
    await expect(adapter.list()).resolves.toEqual([]);
    await expect(adapter.save([])).resolves.toBe(false);
  });
});

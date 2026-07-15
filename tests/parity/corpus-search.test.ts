// Parity tests for src/codecs/corpus/corpus-search.ts against the LIVE
// shipped corpus-search.js (loaded alongside the real corpus.js data via
// tools/harness.mjs). Verbatim algorithm port — every query below is run
// through both implementations and compared exactly.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadCorpusSearch } from '../../tools/harness.mjs';
import { searchCorpus, nearMatches, normalizeCorpusQuery, featureCounts } from '../../src/codecs/corpus/corpus-search.js';
import type { CorpusRecord } from '../../src/codecs/corpus/types.js';

let shipped: ReturnType<typeof loadCorpusSearch>;
let corpus: CorpusRecord[];

beforeAll(() => {
  shipped = loadCorpusSearch();
  corpus = shipped.corpus as CorpusRecord[];
});

describe('normalizeCorpusQuery parity', () => {
  it('matches the shipped normalizer for a range of inputs', () => {
    const cases = ['  Hello World  ', '팩맨!!', 'pac-man', 'A/B_C', null, undefined, 123, '한글.,/\\_()[]{}!?"\'', '   '];
    for (const c of cases) {
      expect(normalizeCorpusQuery(c)).toBe(shipped.normalizeCorpusQuery(c));
    }
  });
});

describe('searchCorpus parity (real corpus data, real queries)', () => {
  it('matches the shipped searchCorpus exactly for a range of queries', () => {
    const queries = [
      '고양이', 'cat', '팩맨', 'pac man', '지도', 'map', '천문', 'space', '우주',
      '알파벳', 'abc', '', '   ', 'zzzznotarealquery', '삼국시대', corpus[0]?.title || '',
    ];
    for (const q of queries) {
      const extracted = searchCorpus(corpus, q);
      const live = shipped.searchCorpus(q);
      expect(extracted).toEqual(live);
    }
  });

  it('matches with explicit limit/minScore/features options', () => {
    const opts = [{ limit: 3 }, { minScore: 50 }, { limit: 20, minScore: 0 }, { features: ['dotpadCompatible'] }];
    for (const o of opts) {
      expect(searchCorpus(corpus, '지도', o)).toEqual(shipped.searchCorpus('지도', o));
    }
  });

  it('title-exact match ranks first, deterministically, for an exact corpus title', () => {
    const title = corpus[0].title;
    const extracted = searchCorpus(corpus, title);
    const live = shipped.searchCorpus(title);
    expect(extracted).toEqual(live);
    expect(extracted[0]?.reason).toBe('title-exact');
  });
});

describe('nearMatches parity', () => {
  it('matches the shipped nearMatches for near-miss queries', () => {
    const queries = ['행성계', 'plane', '고양', 'catt', 'zzznotreal', ''];
    for (const q of queries) {
      expect(nearMatches(corpus, q)).toEqual(shipped.nearMatches(q));
    }
  });
});

describe('featureCounts parity', () => {
  it('matches the shipped corpusFeatureCounts', () => {
    expect(featureCounts(corpus)).toEqual(shipped.featureCounts());
  });
});

describe('corpusCtxFor parity (multi-page navigation context)', () => {
  it('matches the shipped corpusCtxFor exactly, incl. null for single-page/unknown records', async () => {
    const { loadStudioClass, makeInstance } = await import('../../tools/harness.mjs');
    const { corpusCtxFor } = await import('../../src/codecs/corpus/corpus-search.js');
    const { Component } = loadStudioClass({ corpus });
    const proto = Component.prototype;
    const inst = makeInstance(Component);

    const multiPageRecord = corpus.find((r: any) => Array.isArray(r.pages) && r.pages.length > 1)!;
    expect(multiPageRecord).toBeTruthy();

    const cases = [
      { id: multiPageRecord.id, title: multiPageRecord.title, pageIndex: 1 },
      { id: multiPageRecord.id, title: multiPageRecord.title }, // no pageIndex -> defaults to 0
      { id: multiPageRecord.id, title: multiPageRecord.title, pageIndex: 999 }, // out of range -> 0
      { id: 'not-a-real-id', title: 'nope' },
    ];
    for (const c of cases) {
      const extracted = corpusCtxFor(corpus, c, 'some query');
      inst.state = { cmdPrompt: 'some query' };
      const live = proto.corpusCtxFor.call(inst, c);
      expect(extracted).toEqual(live);
    }

    const singlePageRecord = corpus.find((r: any) => Array.isArray(r.pages) && r.pages.length === 1);
    if (singlePageRecord) {
      const c = { id: singlePageRecord.id, title: singlePageRecord.title, pageIndex: 0 };
      expect(corpusCtxFor(corpus, c, '')).toBeNull();
      inst.state = { cmdPrompt: '' };
      expect(proto.corpusCtxFor.call(inst, c)).toBeNull();
    }
  });
});

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

import { describe, it, expect } from 'vitest';
import { searchCorpus, nearMatches } from '../search';

describe('searchCorpus', () => {
  it('matches a Korean title query', () => {
    const hits = searchCorpus('삼국시대', 'ko');
    expect(hits[0]?.graphic.id).toBe('dtms-삼국시대-영토-변화');
  });

  it('matches an English tag query', () => {
    const hits = searchCorpus('cell', 'en');
    expect(hits.map((h) => h.graphic.id)).toContain('dtms-세포-구조');
  });

  it('matches a hyphenated title with mixed case', () => {
    const hits = searchCorpus('Pac-Man', 'en');
    expect(hits[0]?.graphic.id).toBe('dtms-pac-man-8-bit');
  });

  it('ranks a whole-title match above a category-only match', () => {
    const hits = searchCorpus('토성', 'ko');
    expect(hits[0]?.graphic.id).toBe('dtms-토성');
  });

  it('returns nothing for a blank query', () => {
    expect(searchCorpus('   ', 'ko')).toHaveLength(0);
  });

  it('returns nothing for a true miss', () => {
    expect(searchCorpus('asdfqwerzxcv', 'ko')).toHaveLength(0);
  });

  it('near-matches surface page-content candidates on a strict miss', () => {
    // "고구려" appears in the 삼국시대 page desc, not in any title/tag.
    expect(searchCorpus('고구려', 'ko')).toHaveLength(0);
    const near = nearMatches('고구려', 'ko');
    expect(near.map((h) => h.graphic.id)).toContain('dtms-삼국시대-영토-변화');
  });

  it('near-matches exclude strict hits and stay empty on a true miss', () => {
    expect(nearMatches('삼국시대', 'ko').some((h) => h.graphic.id === 'dtms-삼국시대-영토-변화')).toBe(false);
    expect(nearMatches('asdfqwerzxcv', 'ko')).toHaveLength(0);
  });
});

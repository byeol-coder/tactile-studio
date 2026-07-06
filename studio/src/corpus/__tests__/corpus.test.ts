import { describe, it, expect } from 'vitest';
import { getCorpus } from '../index';

/** Guards the generated corpus (scripts/ingest-dtms.mjs) shape + channels. */
describe('DTMS corpus', () => {
  const corpus = getCorpus();

  it('ingested the 11 curated samples', () => {
    expect(corpus).toHaveLength(11);
  });

  it('preserves multi-page structure with expected page counts', () => {
    const pages = Object.fromEntries(corpus.map((g) => [g.id, g.pages.length]));
    expect(pages['dtms-삼국시대-영토-변화']).toBe(6);
    expect(pages['dtms-한반도']).toBe(12);
    expect(pages['dtms-세포-구조']).toBe(10);
    expect(pages['dtms-토성']).toBe(1);
    expect(pages['dtms-자음']).toBe(21);
    expect(pages['dtms-문장부호']).toBe(24);
    expect(pages['dtms-영어-발음기호표']).toBe(50);
  });

  it('cleans review/author noise from titles', () => {
    const titles = corpus.map((g) => g.title);
    expect(titles).toContain('자음'); // was "(검수반영) 자음"
    expect(titles).toContain('모음'); // was "검수반영) 모음"
    expect(titles).toContain('영어 발음기호표'); // was "영어 발음기호표(이샛별)"
    expect(titles.every((t) => !t.includes('검수반영'))).toBe(true);
  });

  it('every graphic is a 60×40 spec with a graphic HEX per page', () => {
    for (const g of corpus) {
      expect(g.spec).toBe('60x40');
      for (const p of g.pages) {
        expect(p.data).toMatch(/^[0-9a-fA-F]{600}$/); // 300 bytes
      }
    }
  });

  it('preserves the braille channel where the source has one', () => {
    const cell = corpus.find((g) => g.id === 'dtms-세포-구조')!;
    expect(cell.pages.every((p) => typeof p.braille === 'string' && p.braille.length > 0)).toBe(true);
  });

  it('omits audio (all current samples have empty audio)', () => {
    const audioPages = corpus.flatMap((g) => g.pages).filter((p) => p.audio);
    expect(audioPages).toHaveLength(0);
  });

  it('assigns categories and tags', () => {
    const byId = Object.fromEntries(corpus.map((g) => [g.id, g]));
    expect(byId['dtms-토성'].category).toBe('science');
    expect(byId['dtms-자음'].category).toBe('language');
    expect(byId['dtms-한반도'].category).toBe('geography');
    expect(byId['dtms-pac-man-8-bit'].category).toBe('basic');
    expect(byId['dtms-자음'].tags).toContain('한글');
  });
});

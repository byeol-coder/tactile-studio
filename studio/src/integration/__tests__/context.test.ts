import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_ORIGINS,
  isAllowedOrigin,
  parseContext,
  parseContextMessage,
  toolForUsageMode,
} from '../context';

describe('parseContext', () => {
  it('empty query → empty context', () => {
    expect(parseContext('')).toEqual({});
    expect(parseContext('?')).toEqual({});
  });

  it('parses and validates scalar fields', () => {
    const ctx = parseContext(
      '?sourceType=library&templateId=math-graph&gridSize=96x64&lang=en&pinDepth=32&exportTarget=emboss&returnUrl=https://x/y&parentOrigin=https://tactileworld.org',
    );
    expect(ctx).toMatchObject({
      sourceType: 'library',
      templateId: 'math-graph',
      gridSize: '96x64',
      lang: 'en',
      pinDepth: 32,
      exportTarget: 'emboss',
      returnUrl: 'https://x/y',
      parentOrigin: 'https://tactileworld.org',
    });
  });

  it('drops invalid enum values', () => {
    const ctx = parseContext('?gridSize=1234&lang=fr&sourceType=bogus&exportTarget=fax');
    expect(ctx.gridSize).toBeUndefined();
    expect(ctx.lang).toBeUndefined();
    expect(ctx.sourceType).toBeUndefined();
    expect(ctx.exportTarget).toBeUndefined();
  });

  it('parses embed/preview flags and derives usageMode', () => {
    expect(parseContext('?embed=1').usageMode).toBe('edit');
    expect(parseContext('?embed=1&preview=1').usageMode).toBe('view');
    expect(parseContext('?usageMode=play-embed&preview=1').usageMode).toBe('play-embed'); // explicit wins
  });

  it('parses JSON pageMeta and ignores malformed JSON', () => {
    const ok = parseContext('?pageMeta=' + encodeURIComponent('{"title":"세포","subject":"과학"}'));
    expect(ok.pageMeta).toEqual({ title: '세포', subject: '과학' });
    const bad = parseContext('?pageMeta=not-json');
    expect(bad.pageMeta).toBeUndefined();
  });

  it('rejects non-positive pinDepth', () => {
    expect(parseContext('?pinDepth=0').pinDepth).toBeUndefined();
    expect(parseContext('?pinDepth=-4').pinDepth).toBeUndefined();
    expect(parseContext('?pinDepth=abc').pinDepth).toBeUndefined();
  });
});

describe('isAllowedOrigin', () => {
  it('accepts allowlisted origins, rejects others and empties', () => {
    expect(isAllowedOrigin(DEFAULT_ALLOWED_ORIGINS[0])).toBe(true);
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('honors a custom allowlist', () => {
    expect(isAllowedOrigin('https://a.test', ['https://a.test'])).toBe(true);
  });
});

describe('parseContextMessage', () => {
  const allow = ['https://a.test'];
  it('accepts a valid context message from an allowed origin', () => {
    const ctx = parseContextMessage(
      { origin: 'https://a.test', data: { type: 'tactile-studio/context', context: { lang: 'en' } } },
      allow,
    );
    expect(ctx).toEqual({ lang: 'en' });
  });

  it('rejects disallowed origins and non-context payloads', () => {
    expect(parseContextMessage({ origin: 'https://evil.test', data: { type: 'tactile-studio/context', context: {} } }, allow)).toBeNull();
    expect(parseContextMessage({ origin: 'https://a.test', data: { type: 'other' } }, allow)).toBeNull();
    expect(parseContextMessage({ origin: 'https://a.test', data: null }, allow)).toBeNull();
  });
});

describe('toolForUsageMode', () => {
  it('view mode → cursor (read-only navigation)', () => {
    expect(toolForUsageMode('view')).toBe('cursor');
    expect(toolForUsageMode('edit')).toBeUndefined();
  });
});

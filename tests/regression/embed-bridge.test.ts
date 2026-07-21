import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// embed-bridge.js is a classic browser <script> (UMD-style). We load only its
// PURE core (validHex/decideResponse) by evaluating the source with
// window/document undefined, so the browser-wiring branch is skipped. This
// tests the actual shipping file, not a copy.
const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../../embed-bridge.js'), 'utf8');
const mod: { exports: any } = { exports: {} };
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
new Function('module', 'window', 'document', src)(mod, undefined, undefined);
const { validHex, decideResponse } = mod.exports as {
  validHex: (data: string, spec: string) => boolean;
  decideResponse: (ctx: any) => { type: string; payload?: any } | null;
};

const HEX60 = 'a'.repeat(600);
const HEX96 = 'b'.repeat(1536);
const okCtx = (over: Record<string, unknown> = {}) => ({
  fromParentWindow: true,
  eventOrigin: 'https://host.example',
  parentOrigin: 'https://host.example',
  data: { source: 'tactile-world', type: 'request-graphic' },
  getGraphic: () => ({ title: '별자리', spec: '60x40', data: HEX60 }),
  ...over,
});

describe('embed-bridge validHex', () => {
  it('60x40 requires 600 hex chars', () => {
    expect(validHex(HEX60, '60x40')).toBe(true);
    expect(validHex('a'.repeat(599), '60x40')).toBe(false);
  });
  it('96x64 requires 1536 hex chars', () => {
    expect(validHex(HEX96, '96x64')).toBe(true);
    expect(validHex(HEX60, '96x64')).toBe(false);
  });
  it('rejects non-hex', () => {
    expect(validHex('z'.repeat(600), '60x40')).toBe(false);
  });
});

describe('embed-bridge decideResponse — happy path', () => {
  it('answers request-graphic with a graphic message', () => {
    const r = decideResponse(okCtx());
    expect(r).toEqual({ type: 'graphic', payload: { title: '별자리', spec: '60x40', data: HEX60 } });
  });
  it('clamps title to 60 chars and preserves 96x64 spec', () => {
    const r = decideResponse(okCtx({ getGraphic: () => ({ title: 'x'.repeat(200), spec: '96x64', data: HEX96 }) }));
    expect(r?.payload.title).toHaveLength(60);
    expect(r?.payload.spec).toBe('96x64');
  });
});

describe('embed-bridge decideResponse — rejected/ignored', () => {
  it('ignores messages not from the embedding frame', () => {
    expect(decideResponse(okCtx({ fromParentWindow: false }))).toBeNull();
  });
  it('ignores origin mismatch', () => {
    expect(decideResponse(okCtx({ eventOrigin: 'https://evil.example' }))).toBeNull();
  });
  it('ignores foreign source', () => {
    expect(decideResponse(okCtx({ data: { source: 'somebody-else', type: 'request-graphic' } }))).toBeNull();
  });
  it('leaves locale-change to the app (returns null)', () => {
    expect(decideResponse(okCtx({ data: { source: 'tactile-world', type: 'locale-change', locale: 'en' } }))).toBeNull();
  });
  it('skips origin check when parentOrigin is unknown', () => {
    const r = decideResponse(okCtx({ parentOrigin: null, eventOrigin: 'https://anything' }));
    expect(r?.type).toBe('graphic');
  });
});

describe('embed-bridge decideResponse — graphic-error', () => {
  it('reports no-facade when the app has not exposed a graphic getter', () => {
    const r = decideResponse(okCtx({ getGraphic: undefined }));
    expect(r).toEqual({ type: 'graphic-error', payload: { reason: 'no-facade' } });
  });
  it('reports facade-threw when the getter throws', () => {
    const r = decideResponse(okCtx({ getGraphic: () => { throw new Error('boom'); } }));
    expect(r?.payload.reason).toBe('facade-threw');
  });
  it('reports empty-or-invalid for an empty/invalid graphic', () => {
    const r = decideResponse(okCtx({ getGraphic: () => ({ title: 't', spec: '60x40', data: '' }) }));
    expect(r?.payload.reason).toBe('empty-or-invalid');
  });
});

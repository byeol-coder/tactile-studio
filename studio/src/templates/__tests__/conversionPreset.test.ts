import { describe, expect, it } from 'vitest';
import {
  getTemplate,
  normalizeConversionPreset,
  toPendingConversionPreset,
  type TactileTemplateDefinition,
} from '../catalog';
import { planTemplateLoad } from '../load';

describe('normalizeConversionPreset — safe metadata', () => {
  it('passes through valid preset values', () => {
    expect(normalizeConversionPreset({ threshold: 110, dither: false, invert: false })).toEqual({
      threshold: 110,
      dither: false,
      invert: false,
    });
  });

  it('clamps out-of-range thresholds and rounds fractions', () => {
    expect(normalizeConversionPreset({ threshold: 999, dither: true, invert: true }).threshold).toBe(255);
    expect(normalizeConversionPreset({ threshold: -50 }).threshold).toBe(0);
    expect(normalizeConversionPreset({ threshold: 128.7 }).threshold).toBe(129);
  });

  it('falls back to a safe default for missing/NaN metadata (no crash)', () => {
    expect(normalizeConversionPreset(undefined)).toEqual({ threshold: 128, dither: false, invert: false });
    expect(normalizeConversionPreset(null)).toEqual({ threshold: 128, dither: false, invert: false });
    expect(normalizeConversionPreset({ threshold: Number.NaN } as never).threshold).toBe(128);
    expect(normalizeConversionPreset({} as never)).toEqual({ threshold: 128, dither: false, invert: false });
  });

  it('coerces non-boolean flags to booleans', () => {
    const r = normalizeConversionPreset({ threshold: 100, dither: 1, invert: 0 } as never);
    expect(r.dither).toBe(true);
    expect(r.invert).toBe(false);
  });
});

describe('toPendingConversionPreset', () => {
  it('builds a pending preset for each catalog conversion preset', () => {
    const cases: Record<string, { threshold: number; dither: boolean; invert: boolean }> = {
      'conv-outline': { threshold: 110, dither: false, invert: false },
      'conv-high-contrast': { threshold: 128, dither: false, invert: false },
      'conv-silhouette': { threshold: 150, dither: true, invert: false },
    };
    for (const [id, expected] of Object.entries(cases)) {
      const t = getTemplate(id)!;
      const pending = toPendingConversionPreset(t)!;
      expect(pending.id).toBe(id);
      expect(pending.title.ko && pending.title.en).toBeTruthy();
      expect(pending.preset).toEqual(expected);
    }
  });

  it('returns null for non-preset templates', () => {
    expect(toPendingConversionPreset(getTemplate('edu-math-coordinate-plane')!)).toBeNull();
    expect(toPendingConversionPreset(getTemplate('prim-boundary-frame')!)).toBeNull();
  });

  it('is safe when a preset definition has malformed metadata', () => {
    const broken: TactileTemplateDefinition = {
      ...getTemplate('conv-outline')!,
      preset: { threshold: Number.NaN } as never,
    };
    const pending = toPendingConversionPreset(broken)!;
    expect(pending.preset).toEqual({ threshold: 128, dither: false, invert: false });
  });
});

describe('planTemplateLoad', () => {
  it('conversion presets → arm the image pipeline (no document)', () => {
    const plan = planTemplateLoad('conv-outline', '60x40', 'ko');
    expect(plan.kind).toBe('preset');
    if (plan.kind === 'preset') expect(plan.preset.preset.threshold).toBe(110);
  });

  it('full templates → document', () => {
    const plan = planTemplateLoad('diagram-flowchart', '60x40', 'en');
    expect(plan.kind).toBe('document');
    if (plan.kind === 'document') {
      expect(plan.document.resolution).toBe('60x40');
      expect(plan.document.quality?.activePins).toBeGreaterThan(0);
    }
  });

  it('honors a supported requested grid size for documents', () => {
    const plan = planTemplateLoad('prim-boundary-frame', '96x64', 'ko');
    expect(plan.kind).toBe('document');
    if (plan.kind === 'document') expect(plan.document.cells).toHaveLength(96 * 64);
  });

  it('unknown template id → error', () => {
    expect(planTemplateLoad('bogus', '60x40', 'ko')).toEqual({ kind: 'error' });
  });
});

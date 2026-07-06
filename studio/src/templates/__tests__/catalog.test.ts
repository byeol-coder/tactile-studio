import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  getTemplate,
  templatesForGroup,
  type TemplateCategory,
  type TemplateAssetType,
} from '../catalog';
import { RESOLUTION_DIMS, type TactileResolution } from '../../types/tactile';
import { templateToDocument, resolveTemplateResolution } from '../load';

const CATEGORIES: TemplateCategory[] = ['education', 'diagram', 'primitive', 'image-conversion', 'heritage', 'custom'];
const ASSET_TYPES: TemplateAssetType[] = ['full-template', 'primitive', 'layout', 'conversion-preset'];

describe('template catalog integrity', () => {
  it('has unique, stable ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it('every template has required, valid metadata', () => {
    for (const t of TEMPLATES) {
      expect(t.title.ko && t.title.en).toBeTruthy();
      expect(t.description.ko && t.description.en).toBeTruthy();
      expect(CATEGORIES).toContain(t.category);
      expect(ASSET_TYPES).toContain(t.assetType);
      expect(t.supportedGridSizes.length).toBeGreaterThan(0);
      expect(t.supportedGridSizes).toContain(t.defaultGridSize);
      expect(Array.isArray(t.tags)).toBe(true);
    }
  });

  it('generators exist for loadable templates and produce in-bounds cells on every supported grid', () => {
    for (const t of TEMPLATES) {
      if (t.assetType === 'conversion-preset') {
        expect(t.generate).toBeUndefined();
        expect(t.preset).toBeTruthy();
        continue;
      }
      expect(typeof t.generate).toBe('function');
      for (const res of t.supportedGridSizes) {
        const { width, height } = RESOLUTION_DIMS[res];
        const cells = t.generate!(res);
        expect(cells.length).toBeGreaterThan(0);
        for (const c of cells) {
          expect(Number.isInteger(c.x)).toBe(true);
          expect(Number.isInteger(c.y)).toBe(true);
          expect(c.x >= 0 && c.x < width).toBe(true);
          expect(c.y >= 0 && c.y < height).toBe(true);
        }
      }
    }
  });

  it('covers every major category with at least one starter', () => {
    for (const cat of ['education', 'diagram', 'primitive', 'image-conversion', 'heritage'] as const) {
      expect(TEMPLATES.some((t) => t.category === cat)).toBe(true);
    }
    // education includes multiple subjects
    const subjects = new Set(TEMPLATES.filter((t) => t.category === 'education').map((t) => t.subject));
    expect(subjects.size).toBeGreaterThanOrEqual(3);
  });

  it('recommended group references real templates', () => {
    const rec = templatesForGroup('recommended');
    expect(rec.length).toBeGreaterThan(0);
    expect(rec.every((t) => getTemplate(t.id))).toBe(true);
  });
});

describe('templateToDocument', () => {
  it('produces a valid dense canonical document', () => {
    const t = getTemplate('edu-math-coordinate-plane')!;
    const doc = templateToDocument(t, '60x40', 'en')!;
    expect(doc.resolution).toBe('60x40');
    expect(doc.cells).toHaveLength(60 * 40);
    expect(doc.quality?.activePins).toBeGreaterThan(0);
    expect(doc.title).toBe(t.title.en);
  });

  it('works at 96×64 for supported templates', () => {
    const t = getTemplate('prim-boundary-frame')!;
    const doc = templateToDocument(t, '96x64')!;
    expect(doc.cells).toHaveLength(96 * 64);
  });

  it('returns null for conversion presets (not loadable as documents)', () => {
    const t = getTemplate('conv-outline')!;
    expect(templateToDocument(t, '60x40')).toBeNull();
  });
});

describe('resolveTemplateResolution', () => {
  it('honors a supported requested grid, else falls back to default', () => {
    const t = getTemplate('edu-math-coordinate-plane')!;
    expect(resolveTemplateResolution(t, '96x64')).toBe('96x64');
    expect(resolveTemplateResolution(t, undefined)).toBe(t.defaultGridSize);
    expect(resolveTemplateResolution(t, '28x40' as TactileResolution)).toBe(t.defaultGridSize);
  });
});

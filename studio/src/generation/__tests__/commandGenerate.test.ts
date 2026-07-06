import { describe, expect, it } from 'vitest';
import {
  GENERATION_EXAMPLES,
  generateFromCommand,
  isBlankPrompt,
  resolveGenerationIntent,
  type GenerationIntentId,
} from '../commandGenerate';
import { RESOLUTION_DIMS, type TactileResolution } from '../../types/tactile';

const RESOLUTIONS: TactileResolution[] = ['60x40', '96x64'];

describe('resolveGenerationIntent — known prompts', () => {
  const cases: Array<[string, GenerationIntentId]> = [
    ['Create a coordinate plane for a math lesson', 'coordinate-plane'],
    ['Create a simple cat face tactile graphic', 'cat-face'],
    ['식물 세포 구조를 단순한 촉각 그래픽으로 만들어줘', 'cell-diagram'],
    ['박물관 전시용 건물 정면 윤곽을 만들어줘', 'building-facade'],
    ['draw a star please', 'star'],
    ['a number line', 'number-line'],
    ['make me a flowchart', 'flowchart'],
    ['project timeline', 'timeline'],
    ['나무 그려줘', 'tree'],
    ['basic shapes to start', 'basic-shapes'],
  ];
  it.each(cases)('%s → %s', (prompt, id) => {
    const r = resolveGenerationIntent(prompt);
    expect(r.id).toBe(id);
    expect(r.isFallback).toBe(false);
  });
});

describe('fallback behavior', () => {
  it('unrecognised prompt → fallback draft (not a crash)', () => {
    const r = resolveGenerationIntent('qwertys zxcvbn nonsense 12345');
    expect(r.id).toBe('fallback');
    expect(r.isFallback).toBe(true);
  });

  it('purpose biases the fallback draft', () => {
    expect(resolveGenerationIntent('nonsense', 'museum').id).toBe('building-facade');
    expect(resolveGenerationIntent('nonsense', 'diagram').id).toBe('flowchart');
    expect(resolveGenerationIntent('nonsense', 'map').id).toBe('coordinate-plane');
    expect(resolveGenerationIntent('nonsense', 'object').id).toBe('star');
    // purpose-biased picks are still flagged as fallbacks (prompt didn't match)
    expect(resolveGenerationIntent('nonsense', 'museum').isFallback).toBe(true);
  });

  it('empty / whitespace prompt resolves to a safe fallback, never throws', () => {
    expect(resolveGenerationIntent('').isFallback).toBe(true);
    expect(resolveGenerationIntent('   ').isFallback).toBe(true);
  });
});

describe('isBlankPrompt', () => {
  it('detects empty and whitespace-only prompts', () => {
    expect(isBlankPrompt('')).toBe(true);
    expect(isBlankPrompt('   \n\t ')).toBe(true);
    expect(isBlankPrompt('cat')).toBe(false);
  });
});

describe('generateFromCommand — documents', () => {
  it('returns null for a blank prompt (validation is the caller’s job)', () => {
    expect(generateFromCommand('', '60x40', 'ko')).toBeNull();
    expect(generateFromCommand('   ', '96x64', 'en')).toBeNull();
  });

  it('coordinate plane generation produces a valid document', () => {
    const r = generateFromCommand('coordinate plane', '60x40', 'en')!;
    expect(r.intentId).toBe('coordinate-plane');
    expect(r.isFallback).toBe(false);
    expect(r.document.resolution).toBe('60x40');
    expect(r.document.cells).toHaveLength(60 * 40);
    expect(r.document.quality?.activePins).toBeGreaterThan(0);
    expect(r.document.title).toBe('Coordinate plane');
  });

  it('cat face (simple object) generation produces visible dots', () => {
    const r = generateFromCommand('a cute cat face', '60x40', 'ko')!;
    expect(r.intentId).toBe('cat-face');
    expect(r.document.quality?.activePins).toBeGreaterThan(10);
    expect(r.document.title).toBe('고양이 얼굴');
  });

  it('fallback generation still yields an editable draft', () => {
    const r = generateFromCommand('zzz unknown request', '60x40', 'ko')!;
    expect(r.isFallback).toBe(true);
    expect(r.document.quality?.activePins).toBeGreaterThan(0);
  });

  it('supports both 60×40 and 96×64 with in-bounds cells for every example + intent', () => {
    const prompts = [
      ...GENERATION_EXAMPLES.map((e) => e.en),
      ...GENERATION_EXAMPLES.map((e) => e.ko),
      'zzz total nonsense', // fallback path too
    ];
    for (const res of RESOLUTIONS) {
      const { width, height } = RESOLUTION_DIMS[res];
      for (const prompt of prompts) {
        const r = generateFromCommand(prompt, res, 'en')!;
        expect(r.document.resolution).toBe(res);
        expect(r.document.cells).toHaveLength(width * height);
        expect(r.document.quality?.activePins).toBeGreaterThan(0);
        const allInBounds = r.document.cells.every((c) => c.x >= 0 && c.x < width && c.y >= 0 && c.y < height);
        expect(allInBounds).toBe(true);
      }
    }
  });

  it('every example chip resolves to a real (non-fallback) intent', () => {
    for (const ex of GENERATION_EXAMPLES) {
      expect(resolveGenerationIntent(ex.ko).isFallback).toBe(false);
      expect(resolveGenerationIntent(ex.en).isFallback).toBe(false);
    }
  });
});

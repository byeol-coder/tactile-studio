import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../appState';
import { createEmptyGrid } from '../../utils/tactileGrid';
import { toPendingConversionPreset, getTemplate } from '../../templates/catalog';
import type { TactileDocument } from '../../types/tactile';

const outline = () => toPendingConversionPreset(getTemplate('conv-outline')!)!;
const highContrast = () => toPendingConversionPreset(getTemplate('conv-high-contrast')!)!;
const silhouette = () => toPendingConversionPreset(getTemplate('conv-silhouette')!)!;

function docState(): AppState {
  const doc: TactileDocument = {
    id: 'd',
    title: 'Edit',
    resolution: '60x40',
    cells: createEmptyGrid('60x40'),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return { ...initialState, document: doc, canvasStatus: 'converted' };
}

describe('preset/arm', () => {
  it('arms the preset without creating a document or leaving the empty canvas', () => {
    const s = reducer(initialState, { type: 'preset/arm', preset: outline() });
    expect(s.pendingConversionPreset?.id).toBe('conv-outline');
    expect(s.pendingConversionPreset?.preset).toEqual({ threshold: 110, dither: false, invert: false });
    expect(s.document).toBeNull();
    expect(s.canvasStatus).toBe('empty');
  });

  it('announces guidance in Korean', () => {
    const s = reducer(initialState, { type: 'preset/arm', preset: outline() });
    expect(s.announcement).toContain('이미지를 가져오면 추천 변환 설정이 적용됩니다');
    expect(s.announcement).toContain('윤곽선 변환 프리셋');
  });

  it('announces guidance in English', () => {
    const s = reducer({ ...initialState, language: 'en' }, { type: 'preset/arm', preset: outline() });
    expect(s.announcement).toContain('Recommended conversion settings will be applied when you import an image');
    expect(s.announcement).toContain('Outline conversion preset');
  });

  it('carries the distinct values of each preset', () => {
    expect(reducer(initialState, { type: 'preset/arm', preset: highContrast() }).pendingConversionPreset?.preset).toEqual(
      { threshold: 128, dither: false, invert: false },
    );
    expect(reducer(initialState, { type: 'preset/arm', preset: silhouette() }).pendingConversionPreset?.preset).toEqual(
      { threshold: 150, dither: true, invert: false },
    );
  });
});

describe('pending preset lifecycle', () => {
  it('survives image import so the panel can pre-fill from it', () => {
    const armed = reducer(initialState, { type: 'preset/arm', preset: silhouette() });
    const imported = reducer(armed, {
      type: 'import/start',
      name: 'x.png',
      file: new File([], 'x.png', { type: 'image/png' }),
    });
    expect(imported.canvasStatus).toBe('image-imported');
    expect(imported.pendingConversionPreset?.preset).toEqual({ threshold: 150, dither: true, invert: false });
  });

  it('is cleared when an image conversion produces a document', () => {
    const armed = reducer(initialState, { type: 'preset/arm', preset: outline() });
    const converted = reducer(armed, { type: 'document/convert-image', resolution: '60x40', active: [{ x: 1, y: 1 }] });
    expect(converted.pendingConversionPreset).toBeNull();
    expect(converted.document).not.toBeNull();
  });

  it('is cleared when a finished document arrives (convert/done)', () => {
    const armed = reducer(initialState, { type: 'preset/arm', preset: outline() });
    const done = reducer(armed, {
      type: 'convert/done',
      document: { ...docState().document! },
    });
    expect(done.pendingConversionPreset).toBeNull();
  });

  it('is cleared on canvas reset', () => {
    const armed = reducer(initialState, { type: 'preset/arm', preset: outline() });
    expect(reducer(armed, { type: 'canvas/reset' }).pendingConversionPreset).toBeNull();
  });

  it('preset/clear removes an armed preset', () => {
    const armed = reducer(initialState, { type: 'preset/arm', preset: outline() });
    expect(reducer(armed, { type: 'preset/clear' }).pendingConversionPreset).toBeNull();
  });
});

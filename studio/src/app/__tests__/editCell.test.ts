import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../appState';
import { createEmptyGrid } from '../../utils/tactileGrid';
import type { TactileDocument, TactileResolution } from '../../types/tactile';

function docState(resolution: TactileResolution): AppState {
  const doc: TactileDocument = {
    id: 'd',
    title: 'Edit',
    resolution,
    cells: createEmptyGrid(resolution),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return { ...initialState, document: doc, canvasStatus: 'converted' };
}

function activeAt(doc: TactileDocument, x: number, y: number): boolean {
  return Boolean(doc.cells.find((c) => c.x === x && c.y === y)?.active);
}

describe('document/toggle-cell (canonical model editing)', () => {
  it('toggles a cell raised then lowered on the document', () => {
    let s = docState('60x40');
    expect(activeAt(s.document!, 5, 12)).toBe(false);

    s = reducer(s, { type: 'document/toggle-cell', x: 5, y: 12 });
    expect(activeAt(s.document!, 5, 12)).toBe(true);

    s = reducer(s, { type: 'document/toggle-cell', x: 5, y: 12 });
    expect(activeAt(s.document!, 5, 12)).toBe(false);
  });

  it('recomputes quality on edit', () => {
    let s = docState('60x40');
    s = reducer(s, { type: 'document/toggle-cell', x: 0, y: 0 });
    expect(s.document!.quality?.activePins).toBe(1);
  });

  it('seeds a blank grid when toggling on an empty canvas', () => {
    const s = reducer(initialState, { type: 'document/toggle-cell', x: 2, y: 3 });
    expect(s.document).not.toBeNull();
    expect(s.document!.resolution).toBe('60x40');
    expect(activeAt(s.document!, 2, 3)).toBe(true);
    expect(s.canvasStatus).toBe('converted');
  });

  it('works on a 96x64 grid', () => {
    let s = docState('96x64');
    s = reducer(s, { type: 'document/toggle-cell', x: 95, y: 63 });
    expect(activeAt(s.document!, 95, 63)).toBe(true);
    expect(s.document!.cells).toHaveLength(96 * 64);
  });

  it('does not mutate the previous document (immutability)', () => {
    const s0 = docState('60x40');
    const before = s0.document!;
    const s1 = reducer(s0, { type: 'document/toggle-cell', x: 1, y: 1 });
    expect(activeAt(before, 1, 1)).toBe(false); // original untouched
    expect(activeAt(s1.document!, 1, 1)).toBe(true);
  });
});

describe('language + tts reducer actions', () => {
  it('sets language and tts flags', () => {
    let s = reducer(initialState, { type: 'language/set', language: 'en' });
    expect(s.language).toBe('en');
    s = reducer(s, { type: 'tts/set', enabled: true });
    expect(s.ttsEnabled).toBe(true);
  });

  it('defaults to Korean with TTS off', () => {
    expect(initialState.language).toBe('ko');
    expect(initialState.ttsEnabled).toBe(false);
  });
});

describe('document/convert-image (Phase 2)', () => {
  it('opens a fresh grid at the target resolution and stamps active cells as one undoable command', () => {
    const s0 = { ...initialState, sourceImageName: 'cat.png', canvasStatus: 'image-imported' as const };
    let s = reducer(s0, {
      type: 'document/convert-image',
      resolution: '96x64',
      active: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    expect(s.canvasStatus).toBe('converted');
    expect(s.document!.resolution).toBe('96x64');
    expect(s.document!.cells).toHaveLength(96 * 64);
    expect(activeAt(s.document!, 1, 1)).toBe(true);
    expect(s.document!.quality?.activePins).toBe(2);
    expect(s.history.past).toHaveLength(1); // conversion is one command

    // Undo the conversion → back to the blank imported grid.
    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s.document!, 1, 1)).toBe(false);
    expect(s.document!.quality?.activePins).toBe(0);
    s = reducer(s, { type: 'history/redo' });
    expect(activeAt(s.document!, 2, 2)).toBe(true);
  });

  it('works at 60×40 and carries the image name into the title', () => {
    const s0 = { ...initialState, sourceImageName: 'logo.png' };
    const s = reducer(s0, { type: 'document/convert-image', resolution: '60x40', active: [{ x: 0, y: 0 }] });
    expect(s.document!.resolution).toBe('60x40');
    expect(s.document!.title).toBe('logo');
    expect(s.document!.sourceImageName).toBe('logo.png');
  });
});

describe('context/apply (TactileStudioContext §B)', () => {
  it('inherits language and stores the context', () => {
    const s = reducer(initialState, {
      type: 'context/apply',
      context: { lang: 'en', sourceType: 'library', gridSize: '96x64' },
    });
    expect(s.language).toBe('en');
    expect(s.context.sourceType).toBe('library');
    expect(s.context.gridSize).toBe('96x64');
  });

  it('keeps the current language when context has none', () => {
    const s = reducer(initialState, { type: 'context/apply', context: { sourceType: 'blank' } });
    expect(s.language).toBe('ko');
  });

  it('a new drawing uses the inherited grid size', () => {
    let s = reducer(initialState, { type: 'context/apply', context: { gridSize: '96x64' } });
    s = reducer(s, { type: 'document/toggle-cell', x: 90, y: 60 });
    expect(s.document!.resolution).toBe('96x64');
    expect(s.document!.cells).toHaveLength(96 * 64);
  });
});

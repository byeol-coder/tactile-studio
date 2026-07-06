import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../appState';
import { A11Y } from '../../i18n/messages';
import { generateFromCommand } from '../../generation/commandGenerate';

const doc = () => generateFromCommand('coordinate plane', '60x40', 'ko')!.document;

describe('document/generate (command-based generation v1)', () => {
  it('opens a generated draft as a canonical converted document', () => {
    const s = reducer(initialState, { type: 'document/generate', document: doc(), isFallback: false });
    expect(s.document).not.toBeNull();
    expect(s.canvasStatus).toBe('converted');
    expect(s.history).toEqual({ past: [], future: [] });
  });

  it('announces success in KO and EN', () => {
    const ko = reducer(initialState, { type: 'document/generate', document: doc(), isFallback: false });
    expect(ko.announcement).toBe(A11Y.ko.generationSuccess);
    const en = reducer(
      { ...initialState, language: 'en' },
      { type: 'document/generate', document: doc(), isFallback: false },
    );
    expect(en.announcement).toBe(A11Y.en.generationSuccess);
  });

  it('announces fallback guidance when the draft is a fallback', () => {
    const s = reducer(initialState, { type: 'document/generate', document: doc(), isFallback: true });
    expect(s.announcement).toBe(A11Y.ko.generationFallback);
  });

  it('result is immediately editable and undoable', () => {
    let s = reducer(initialState, { type: 'document/generate', document: doc(), isFallback: false });
    s = reducer(s, { type: 'document/toggle-cell', x: 0, y: 0 });
    expect(s.history.past).toHaveLength(1);
    const activeAfterEdit = Boolean(s.document!.cells.find((c) => c.x === 0 && c.y === 0)?.active);
    expect(activeAfterEdit).toBe(true);
    s = reducer(s, { type: 'history/undo' });
    expect(s.history.past).toHaveLength(0);
    expect(Boolean(s.document!.cells.find((c) => c.x === 0 && c.y === 0)?.active)).toBe(false);
  });

  it('is send-ready when a DotPad is connected', () => {
    const connected = { ...initialState, dotpadStatus: 'connected' as const };
    const s = reducer(connected, { type: 'document/generate', document: doc(), isFallback: false });
    expect(s.sendStatus).toBe('ready');
  });

  it('supersedes an armed conversion preset', () => {
    const armed = { ...initialState, pendingConversionPreset: { id: 'x', title: { ko: 'x', en: 'x' }, preset: { threshold: 1, dither: false, invert: false } } };
    const s = reducer(armed, { type: 'document/generate', document: doc(), isFallback: false });
    expect(s.pendingConversionPreset).toBeNull();
  });
});

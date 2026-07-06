import { describe, expect, it } from 'vitest';
import { A11Y, type Language, type ToolId } from '../messages';

const LANGS: Language[] = ['ko', 'en'];
const TOOLS: ToolId[] = ['cursor', 'pen', 'eraser', 'line', 'rect', 'ellipse', 'polygon', 'bucket', 'select'];

describe('i18n coverage for F1.9 / tools', () => {
  it.each(LANGS)('%s has undo/redo strings', (lang) => {
    const s = A11Y[lang];
    expect(s.nothingToUndo).toBeTruthy();
    expect(s.nothingToRedo).toBeTruthy();
    expect(s.undoLabel).toBeTruthy();
    expect(s.redoLabel).toBeTruthy();
    expect(s.undoOne(1, 1, 'lowered')).toContain(lang === 'ko' ? '실행 취소' : 'Undo');
    expect(s.redoOne(1, 1, 'raised')).toContain(lang === 'ko' ? '다시 실행' : 'Redo');
  });

  it('uses plain cell-state words (점 있음/점 없음, dot present/no dot), not 볼록/오목', () => {
    expect(A11Y.ko.stateWord('raised')).toBe('점 있음');
    expect(A11Y.ko.stateWord('lowered')).toBe('점 없음');
    expect(A11Y.en.stateWord('raised')).toBe('dot present');
    expect(A11Y.en.stateWord('lowered')).toBe('no dot');
    expect(A11Y.ko.undoOne(12, 5, 'lowered')).toBe('실행 취소: 12행 5열, 점 없음으로 복원됨');
    expect(A11Y.ko.redoOne(12, 5, 'raised')).toBe('다시 실행: 12행 5열, 점 있음으로 변경됨');
  });

  it.each(LANGS)('%s has shape-tool strings', (lang) => {
    const s = A11Y[lang];
    expect(s.shapeStart(12, 5)).toBeTruthy();
    expect(s.shapeDone(s.toolName('rect'), 1, 1, 24)).toContain(lang === 'ko' ? '사각형' : 'Rectangle');
    expect(s.shapeCancelled).toBeTruthy();
    expect(s.polygonPoint(2, 3, 4)).toBeTruthy();
    expect(s.polygonNeedMore).toBeTruthy();
    expect(s.fillLabel).toBeTruthy();
    expect(s.fillMode(true)).toBeTruthy();
    expect(s.fillMode(false)).toBeTruthy();
    expect(s.bucketDone(12, 5, 24, 'raised')).toContain(lang === 'ko' ? '채우기' : 'Fill');
  });

  it.each(LANGS)('%s has select/move strings', (lang) => {
    const s = A11Y[lang];
    expect(s.selectStart(3, 4)).toBeTruthy();
    expect(s.selectDone(5, 2)).toBeTruthy();
    expect(s.selectMoved(6, 7)).toBeTruthy();
    expect(s.selectCommitted(false, 10)).toContain(lang === 'ko' ? '이동' : 'Moved');
    expect(s.selectCommitted(true, 10)).toContain(lang === 'ko' ? '복사' : 'Copied');
    expect(s.selectCancelled).toBeTruthy();
    expect(s.copyMode(true)).toBeTruthy();
    expect(s.copyMode(false)).toBeTruthy();
  });

  it.each(LANGS)('%s has quick-action strings', (lang) => {
    const s = A11Y[lang];
    expect(s.clearAllLabel).toBeTruthy();
    expect(s.invertLabel).toBeTruthy();
    expect(s.fitGridLabel).toBeTruthy();
    expect(s.clearConfirm).toBeTruthy();
    expect(s.clearedDone(5)).toContain('5');
    expect(s.invertedDone(5)).toContain('5');
    expect(s.fitGridDone).toBeTruthy();
    expect(s.quickNothing).toBeTruthy();
  });

  it.each(LANGS)('%s names every tool', (lang) => {
    for (const tool of TOOLS) {
      expect(A11Y[lang].toolName(tool)).toBeTruthy();
    }
    expect(A11Y[lang].toolGroup).toBeTruthy();
  });

  it.each(LANGS)('%s has command-generation strings', (lang) => {
    const s = A11Y[lang];
    expect(s.createFromCommand).toBeTruthy();
    expect(s.commandPanelTitle).toBeTruthy();
    expect(s.commandPromptLabel).toBeTruthy();
    expect(s.commandPromptPlaceholder).toBeTruthy();
    expect(s.commandPurposeLabel).toBeTruthy();
    expect(s.commandPurposeAuto).toBeTruthy();
    expect(s.commandGenerate).toBeTruthy();
    expect(s.commandGenerating).toBeTruthy();
    for (const p of ['lesson', 'diagram', 'map', 'object', 'museum', 'guide'] as const) {
      expect(s.commandPurpose(p)).toBeTruthy();
    }
    // Generation announcements — bilingual, and success ≠ fallback.
    expect(s.generationSuccess).toBeTruthy();
    expect(s.generationFallback).toBeTruthy();
    expect(s.generationError).toBeTruthy();
    expect(s.generationEmptyPrompt).toBeTruthy();
    expect(s.generationSuccess).not.toBe(s.generationFallback);
  });

  it.each(LANGS)('%s has corpus (DTMS library) strings', (lang) => {
    const s = A11Y[lang];
    expect(s.corpusResultsLabel(3)).toContain('3');
    expect(s.corpusPagesLabel(5)).toContain('5');
    expect(s.corpusSeeded('토성')).toContain('토성');
    for (const c of ['science', 'language', 'geography', 'basic'] as const) {
      expect(s.corpusCategory(c)).toBeTruthy();
    }
    expect(s.corpusPickPage).toBeTruthy();
    expect(s.corpusMissTitle).toBeTruthy();
    expect(s.corpusNearLabel).toBeTruthy();
    expect(s.corpusGenerateInstead).toBeTruthy();
    expect(s.corpusUseImage).toBeTruthy();
    expect(s.corpusMissHint).toBeTruthy();
    expect(s.corpusLibraryTitle).toBeTruthy();
  });

  it('command-generation announcements match the spec wording', () => {
    expect(A11Y.ko.generationSuccess).toBe('명령어로 촉각 그래픽 초안을 만들었습니다.');
    expect(A11Y.en.generationSuccess).toBe('Created a tactile graphic draft from your command.');
    // KO and EN are genuinely localized (not the same string).
    expect(A11Y.ko.generationSuccess).not.toBe(A11Y.en.generationSuccess);
    expect(A11Y.ko.createFromCommand).not.toBe(A11Y.en.createFromCommand);
  });
});

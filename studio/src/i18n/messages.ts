/**
 * Minimal i18n seam (spec F0.3 / F1.2 §7).
 *
 * The studio app did not yet have an i18n system; this establishes one scoped
 * to the accessibility layer so no a11y string is hard-coded. Existing UI
 * strings elsewhere are intentionally left untouched (out of scope — avoids a
 * broad redesign); they can migrate to this catalog incrementally.
 *
 * Korean is the default per project convention. Required KO terms (spec §7):
 * raised = 볼록, lowered = 오목, row = 행, column = 열.
 */
export type Language = 'ko' | 'en';

/** Whether a tactile cell is raised (pin up) or lowered (pin down). */
export type CellState = 'raised' | 'lowered';

/** Editing tools (LeftRail). `cursor` is the default navigation mode; `pen`
 * and `eraser` are wired in F1.3/F1.7. The rest are forward-compatible
 * placeholders for F1.4–F1.8. */
export type ToolId =
  | 'cursor'
  | 'pen'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'bucket'
  | 'select';

/** Which grid edge a blocked cursor move ran into. */
export type BoundaryEdge = 'firstRow' | 'lastRow' | 'firstColumn' | 'lastColumn' | 'outside';

export interface A11yStrings {
  /** Word for a cell state, e.g. 볼록 / raised. */
  stateWord: (state: CellState) => string;
  /** Canvas accessible label. row/col counts included for orientation. */
  canvasLabel: (cols: number, rows: number) => string;
  /** Concise keyboard instructions (linked via aria-describedby). */
  keyboardHint: string;
  /** Cursor position announcement, e.g. "12행 5열, 볼록". row/col are 1-based. */
  position: (row: number, col: number, state: CellState) => string;
  /** Toggle-result announcement, e.g. "12행 5열, 볼록으로 변경됨". */
  toggled: (row: number, col: number, state: CellState) => string;
  /** Boundary announcement, e.g. "마지막 열입니다". */
  boundary: (edge: BoundaryEdge) => string;
  /** TTS toggle state announcement. */
  ttsToggle: (on: boolean) => string;
  /** TTS control accessible label. */
  ttsLabel: string;
  /** Assertive error for an unsupported grid size. */
  unsupportedGrid: string;
  /** Language toggle control label. */
  languageLabel: string;
  /** Display name of this language for the toggle. */
  languageName: string;
  /** Compact position for the BottomPanel status bar, e.g. "12행 5열". */
  positionShort: (row: number, col: number) => string;
  /** BottomPanel field labels. */
  panel: { region: string; position: string; state: string; tool: string; status: string };
  /** Tool display name. */
  toolName: (tool: ToolId) => string;
  /** Placeholder when there is no active grid/value. */
  none: string;
  /** LeftRail tool group label. */
  toolGroup: string;
  /** Undo/redo availability labels for the BottomPanel. */
  undoLabel: string;
  redoLabel: string;
  available: string;
  unavailable: string;
  /** Undo/redo announcements (single-cell and bulk). */
  undoOne: (row: number, col: number, state: CellState) => string;
  redoOne: (row: number, col: number, state: CellState) => string;
  undoMany: (count: number) => string;
  redoMany: (count: number) => string;
  nothingToUndo: string;
  nothingToRedo: string;
  /** Shape tools (F1.4 line, F1.5 rect/ellipse/polygon) announcements. */
  shapeStart: (row: number, col: number) => string;
  shapeDone: (shape: string, row: number, col: number, count: number) => string;
  shapeCancelled: string;
  polygonPoint: (n: number, row: number, col: number) => string;
  polygonNeedMore: string;
  /** Bucket fill (F1.6) result announcement. */
  bucketDone: (row: number, col: number, count: number, state: CellState) => string;
  /** Select/move (F1.8) announcements + copy toggle. */
  selectStart: (row: number, col: number) => string;
  selectDone: (w: number, h: number) => string;
  selectMoved: (row: number, col: number) => string;
  selectCommitted: (copy: boolean, count: number) => string;
  selectCancelled: string;
  copyLabel: string;
  copyMode: (copy: boolean) => string;
  /** Quick Actions (F1.10) — labels, confirm, and result announcements. */
  quickActionsLabel: string;
  clearAllLabel: string;
  invertLabel: string;
  fitGridLabel: string;
  clearConfirm: string;
  clearedDone: (count: number) => string;
  invertedDone: (count: number) => string;
  fitGridDone: string;
  quickNothing: string;
  /** Outline/fill toggle. */
  fillLabel: string;
  fillMode: (fill: boolean) => string;
  /** Image import panel (Phase 2). */
  imageResolution: string;
  imageThreshold: string;
  imageDither: string;
  imageInvert: string;
  imagePreview: string;
  imageApply: string;
  imageConverting: string;
  loadImageError: string;
  loadLayerError: string;
  /** Starter Template Library (broad, not subject-only). */
  startFromTemplate: string;
  templateLibraryTitle: string;
  templateLoadError: string;
  templateLoaded: (title: string) => string;
  templateReplaceConfirm: string;
  conversionPresetHint: string;
  /** Announced when an image-conversion preset is armed for the next import. */
  conversionPresetSelected: (name: string) => string;
  /** Short banner shown near the import controls while a preset is armed. */
  conversionPresetActive: (name: string) => string;
  /** Command-based generation (v1). */
  createFromCommand: string;
  commandPanelTitle: string;
  commandPromptLabel: string;
  commandPromptPlaceholder: string;
  commandPurposeLabel: string;
  commandPurposeAuto: string;
  commandPurpose: (p: 'lesson' | 'diagram' | 'map' | 'object' | 'museum' | 'guide') => string;
  commandExamplesLabel: string;
  commandGenerate: string;
  commandGenerating: string;
  generationSuccess: string;
  generationFallback: string;
  generationError: string;
  generationEmptyPrompt: string;
  /** Corpus (DTMS library) search + seed (spec B). */
  corpusResultsLabel: (n: number) => string;
  corpusCategory: (c: 'science' | 'language' | 'geography' | 'basic') => string;
  corpusPagesLabel: (n: number) => string;
  corpusPickPage: string;
  corpusSeeded: (title: string) => string;
  corpusMissTitle: string;
  corpusNearLabel: string;
  corpusGenerateInstead: string;
  corpusUseImage: string;
  corpusMissHint: string;
  corpusBack: string;
  corpusLibraryTitle: string;
  templateGroups: {
    recommended: string;
    education: string;
    diagram: string;
    primitive: string;
    'image-conversion': string;
    heritage: string;
  };
}

/**
 * User-facing cell-state words. Deliberately plain ("점 있음/점 없음",
 * "dot present/no dot") rather than the expert terms 볼록/오목 — clearer for
 * non-expert teachers/creators. Single source of truth for every announcement.
 */
const STATE_WORD: Record<Language, Record<CellState, string>> = {
  ko: { raised: '점 있음', lowered: '점 없음' },
  en: { raised: 'dot present', lowered: 'no dot' },
};

export const A11Y: Record<Language, A11yStrings> = {
  ko: {
    stateWord: (state) => STATE_WORD.ko[state],
    canvasLabel: (cols, rows) =>
      `촉각 캔버스, ${cols}×${rows} 그리드. 화살표 키로 이동하고 스페이스 또는 엔터로 점을 켜고 끕니다.`,
    keyboardHint:
      '화살표 키로 셀을 이동합니다. 스페이스 또는 엔터로 점 있음과 점 없음을 전환합니다. Home과 End로 행의 양 끝, Ctrl 또는 Cmd와 함께 누르면 그리드의 처음과 끝으로 이동합니다. Shift와 화살표로 10칸씩 이동합니다.',
    position: (row, col, state) => `${row}행 ${col}열, ${STATE_WORD.ko[state]}`,
    toggled: (row, col, state) => `${row}행 ${col}열, ${STATE_WORD.ko[state]}으로 변경됨`,
    boundary: (edge) =>
      ({
        firstRow: '첫 번째 행입니다',
        lastRow: '마지막 행입니다',
        firstColumn: '첫 번째 열입니다',
        lastColumn: '마지막 열입니다',
        outside: '캔버스 밖으로 이동할 수 없습니다',
      })[edge],
    ttsToggle: (on) => (on ? '음성 안내 켜짐' : '음성 안내 꺼짐'),
    ttsLabel: '음성 안내',
    unsupportedGrid: '지원하지 않는 그리드 크기입니다',
    languageLabel: '언어',
    languageName: '한국어',
    positionShort: (row, col) => `${row}행 ${col}열`,
    panel: { region: '편집 상태', position: '위치', state: '상태', tool: '도구', status: '상태 메시지' },
    toolName: (tool) =>
      ({ cursor: '커서', pen: '펜', eraser: '지우개', line: '선', rect: '사각형', ellipse: '타원', polygon: '다각형', bucket: '채우기', select: '선택' })[
        tool
      ],
    none: '—',
    toolGroup: '편집 도구',
    undoLabel: '실행 취소',
    redoLabel: '다시 실행',
    available: '가능',
    unavailable: '없음',
    undoOne: (row, col, state) => `실행 취소: ${row}행 ${col}열, ${STATE_WORD.ko[state]}으로 복원됨`,
    redoOne: (row, col, state) => `다시 실행: ${row}행 ${col}열, ${STATE_WORD.ko[state]}으로 변경됨`,
    undoMany: (count) => `실행 취소: ${count}개 셀 복원됨`,
    redoMany: (count) => `다시 실행: ${count}개 셀 변경됨`,
    nothingToUndo: '실행 취소할 작업이 없습니다',
    nothingToRedo: '다시 실행할 작업이 없습니다',
    shapeStart: (row, col) => `시작점: ${row}행 ${col}열`,
    shapeDone: (shape, row, col, count) => `${shape}: ${row}행 ${col}열에서, 점 ${count}개`,
    shapeCancelled: '도형 그리기 취소됨',
    polygonPoint: (n, row, col) => `다각형 점 ${n}: ${row}행 ${col}열`,
    polygonNeedMore: '다각형은 점이 2개 이상 필요합니다',
    bucketDone: (row, col, count, state) =>
      `채우기: ${row}행 ${col}열, ${count}개 셀 ${STATE_WORD.ko[state]}으로 변경됨`,
    selectStart: (row, col) => `선택 시작: ${row}행 ${col}열`,
    selectDone: (w, h) => `선택 영역: 너비 ${w}, 높이 ${h}`,
    selectMoved: (row, col) => `이동 위치: ${row}행 ${col}열`,
    selectCommitted: (copy, count) => `${copy ? '복사' : '이동'} 완료: ${count}개 셀`,
    selectCancelled: '선택 취소됨',
    copyLabel: '복사 모드',
    copyMode: (copy) => (copy ? '복사' : '이동'),
    quickActionsLabel: '빠른 작업',
    clearAllLabel: '전체 지우기',
    invertLabel: '반전',
    fitGridLabel: '그리드 맞춤',
    clearConfirm: '모든 점을 지울까요? 실행 취소로 되돌릴 수 있습니다.',
    clearedDone: (count) => `전체 지우기: ${count}개 셀을 점 없음으로 변경했습니다`,
    invertedDone: (count) => `반전: ${count}개 셀을 반전했습니다`,
    fitGridDone: '그리드 맞춤: 내용을 가운데로 이동했습니다',
    quickNothing: '적용할 내용이 없습니다',
    fillLabel: '채움',
    fillMode: (fill) => (fill ? '채움' : '윤곽'),
    imageResolution: '그리드 크기',
    imageThreshold: '임계값',
    imageDither: '디더링',
    imageInvert: '반전',
    imagePreview: '미리보기',
    imageApply: '변환 적용',
    imageConverting: '이미지를 변환하는 중…',
    loadImageError: '이미지를 불러올 수 없습니다',
    loadLayerError: '촉각 문서를 불러올 수 없습니다',
    startFromTemplate: '템플릿으로 시작',
    templateLibraryTitle: '스타터 템플릿',
    templateLoadError: '템플릿을 불러올 수 없습니다',
    templateLoaded: (title) => `${title} 템플릿을 불러왔습니다`,
    templateReplaceConfirm: '현재 작업을 템플릿으로 대체할까요? 실행 취소할 수 없습니다.',
    conversionPresetHint: '이미지를 가져온 뒤 사용할 수 있는 변환 프리셋입니다',
    conversionPresetSelected: (name) =>
      `${name}이(가) 선택되었습니다. 이미지를 가져오면 추천 변환 설정이 적용됩니다.`,
    conversionPresetActive: (name) => `${name} · 이미지를 가져오면 적용됩니다`,
    createFromCommand: '명령어로 만들기',
    commandPanelTitle: '명령어로 촉각 그래픽 만들기',
    commandPromptLabel: '명령어',
    commandPromptPlaceholder: '예: 수학 수업용 좌표평면을 만들어줘',
    commandPurposeLabel: '용도(선택)',
    commandPurposeAuto: '자동 인식',
    commandPurpose: (p) =>
      ({ lesson: '수업', diagram: '다이어그램', map: '지도', object: '사물', museum: '박물관', guide: '안내' })[p],
    commandExamplesLabel: '예시 명령어',
    commandGenerate: '생성',
    commandGenerating: '생성하는 중…',
    generationSuccess: '명령어로 촉각 그래픽 초안을 만들었습니다.',
    generationFallback: '명령을 정확히 인식하지 못해 기본 초안을 만들었습니다. 편집해서 완성하세요.',
    generationError: '촉각 그래픽을 만들지 못했습니다.',
    generationEmptyPrompt: '명령어를 입력하세요.',
    corpusResultsLabel: (n) => `라이브러리 검색 결과 ${n}건`,
    corpusCategory: (c) =>
      ({ science: '과학', language: '언어', geography: '지리·역사', basic: '기타' })[c],
    corpusPagesLabel: (n) => (n > 1 ? `${n}쪽` : '1쪽'),
    corpusPickPage: '시작점으로 사용할 쪽을 선택하세요',
    corpusSeeded: (title) => `"${title}"의 그래픽을 편집기로 불러왔습니다.`,
    corpusMissTitle: '정확히 일치하는 라이브러리 항목이 없습니다.',
    corpusNearLabel: '비슷한 항목',
    corpusGenerateInstead: '명령으로 새 그래픽 그리기',
    corpusUseImage: '이미지로 만들기',
    corpusMissHint: '원하는 그래픽이 없으면 이미지 변환으로 직접 만들 수 있어요.',
    corpusBack: '← 검색으로',
    corpusLibraryTitle: 'DTMS 라이브러리',
    templateGroups: {
      recommended: '추천',
      education: '교육',
      diagram: '다이어그램',
      primitive: '촉각 요소',
      'image-conversion': '이미지 변환',
      heritage: '박물관·유산',
    },
  },
  en: {
    stateWord: (state) => STATE_WORD.en[state],
    canvasLabel: (cols, rows) =>
      `Tactile canvas, ${cols} by ${rows} grid. Use arrow keys to move, Space or Enter to toggle a dot.`,
    keyboardHint:
      'Arrow keys move the cell cursor. Space or Enter toggles a dot. Home and End jump to the row ends; hold Ctrl or Cmd to jump to the grid start and end. Shift with an arrow moves 10 cells.',
    position: (row, col, state) => `Row ${row}, column ${col}, ${STATE_WORD.en[state]}`,
    toggled: (row, col, state) => `Row ${row}, column ${col} changed to ${STATE_WORD.en[state]}`,
    boundary: (edge) =>
      ({
        firstRow: 'First row',
        lastRow: 'Last row',
        firstColumn: 'First column',
        lastColumn: 'Last column',
        outside: 'Cannot move outside the canvas',
      })[edge],
    ttsToggle: (on) => (on ? 'Voice readout on' : 'Voice readout off'),
    ttsLabel: 'Voice readout',
    unsupportedGrid: 'Unsupported grid size',
    languageLabel: 'Language',
    languageName: 'English',
    positionShort: (row, col) => `Row ${row}, Col ${col}`,
    panel: { region: 'Editor status', position: 'Position', state: 'State', tool: 'Tool', status: 'Status' },
    toolName: (tool) =>
      ({ cursor: 'Cursor', pen: 'Pen', eraser: 'Eraser', line: 'Line', rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', bucket: 'Bucket fill', select: 'Select' })[
        tool
      ],
    none: '—',
    toolGroup: 'Editing tools',
    undoLabel: 'Undo',
    redoLabel: 'Redo',
    available: 'available',
    unavailable: 'none',
    undoOne: (row, col, state) => `Undo: row ${row}, column ${col} restored to ${STATE_WORD.en[state]}`,
    redoOne: (row, col, state) => `Redo: row ${row}, column ${col} changed to ${STATE_WORD.en[state]}`,
    undoMany: (count) => `Undo: ${count} cells restored`,
    redoMany: (count) => `Redo: ${count} cells changed`,
    nothingToUndo: 'Nothing to undo',
    nothingToRedo: 'Nothing to redo',
    shapeStart: (row, col) => `Start: row ${row}, column ${col}`,
    shapeDone: (shape, row, col, count) => `${shape}: from row ${row}, column ${col}, ${count} dots`,
    shapeCancelled: 'Shape cancelled',
    polygonPoint: (n, row, col) => `Polygon point ${n}: row ${row}, column ${col}`,
    polygonNeedMore: 'A polygon needs at least 2 points',
    bucketDone: (row, col, count, state) =>
      `Fill: row ${row}, column ${col}, ${count} cells set to ${STATE_WORD.en[state]}`,
    selectStart: (row, col) => `Selection start: row ${row}, column ${col}`,
    selectDone: (w, h) => `Selection: ${w} by ${h}`,
    selectMoved: (row, col) => `Moved to row ${row}, column ${col}`,
    selectCommitted: (copy, count) => `${copy ? 'Copied' : 'Moved'}: ${count} cells`,
    selectCancelled: 'Selection cancelled',
    copyLabel: 'Copy mode',
    copyMode: (copy) => (copy ? 'Copy' : 'Move'),
    quickActionsLabel: 'Quick actions',
    clearAllLabel: 'Clear all',
    invertLabel: 'Invert',
    fitGridLabel: 'Fit to grid',
    clearConfirm: 'Clear all dots? You can undo this.',
    clearedDone: (count) => `Cleared: ${count} cells set to no dot`,
    invertedDone: (count) => `Inverted: ${count} cells`,
    fitGridDone: 'Fit to grid: content centered',
    quickNothing: 'Nothing to apply',
    fillLabel: 'Fill',
    fillMode: (fill) => (fill ? 'Fill' : 'Outline'),
    imageResolution: 'Grid size',
    imageThreshold: 'Threshold',
    imageDither: 'Dithering',
    imageInvert: 'Invert',
    imagePreview: 'Preview',
    imageApply: 'Apply conversion',
    imageConverting: 'Converting image…',
    loadImageError: 'Could not load the image',
    loadLayerError: 'Could not load the tactile document',
    startFromTemplate: 'Start from template',
    templateLibraryTitle: 'Starter templates',
    templateLoadError: 'Could not load the template',
    templateLoaded: (title) => `Loaded template: ${title}`,
    templateReplaceConfirm: 'Replace the current work with this template? This cannot be undone.',
    conversionPresetHint: 'A conversion preset — use it after importing an image',
    conversionPresetSelected: (name) =>
      `${name} selected. Recommended conversion settings will be applied when you import an image.`,
    conversionPresetActive: (name) => `${name} · applied when you import an image`,
    createFromCommand: 'Create from command',
    commandPanelTitle: 'Create a tactile graphic from a command',
    commandPromptLabel: 'Command',
    commandPromptPlaceholder: 'e.g. Create a coordinate plane for a math lesson',
    commandPurposeLabel: 'Purpose (optional)',
    commandPurposeAuto: 'Auto-detect',
    commandPurpose: (p) =>
      ({ lesson: 'Lesson', diagram: 'Diagram', map: 'Map', object: 'Object', museum: 'Museum', guide: 'Guide' })[p],
    commandExamplesLabel: 'Example commands',
    commandGenerate: 'Generate',
    commandGenerating: 'Generating…',
    generationSuccess: 'Created a tactile graphic draft from your command.',
    generationFallback: "Couldn't match your command exactly — created a starter draft you can edit.",
    generationError: "Couldn't create a tactile graphic.",
    generationEmptyPrompt: 'Enter a command first.',
    corpusResultsLabel: (n) => `${n} library match${n === 1 ? '' : 'es'}`,
    corpusCategory: (c) =>
      ({ science: 'Science', language: 'Language', geography: 'Geography & history', basic: 'Other' })[c],
    corpusPagesLabel: (n) => (n > 1 ? `${n} pages` : '1 page'),
    corpusPickPage: 'Choose a page to start from',
    corpusSeeded: (title) => `Loaded "${title}" into the editor.`,
    corpusMissTitle: 'No exact library match.',
    corpusNearLabel: 'Similar items',
    corpusGenerateInstead: 'Draw a new one from the command',
    corpusUseImage: 'Create from image',
    corpusMissHint: "Not what you need? Create one from an image instead.",
    corpusBack: '← Back to search',
    corpusLibraryTitle: 'DTMS library',
    templateGroups: {
      recommended: 'Recommended',
      education: 'Education',
      diagram: 'Diagrams',
      primitive: 'Tactile elements',
      'image-conversion': 'Image conversion',
      heritage: 'Museum / Heritage',
    },
  },
};

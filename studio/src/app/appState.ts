import { createContext, useContext } from 'react';
import type { DotPadStatus, SendStatus } from '../types/dotpad';
import { RESOLUTION_DIMS, type CanvasStatus, type TactileCell, type TactileDocument, type TactileResolution } from '../types/tactile';
import { A11Y, type CellState, type Language, type ToolId } from '../i18n/messages';
import { clampCursor, type CursorPos } from '../a11y/cursor';
import { fitToGridChanges } from '../geometry/region';
import type { TactileStudioContext } from '../integration/context';
import {
  applyChanges,
  effectiveChanges,
  mergeStrokeChanges,
  type CellChange,
  type DocumentCommand,
} from '../history/commands';
import { computeQuality, createEmptyGrid } from '../utils/tactileGrid';
import type { PendingConversionPreset } from '../templates/catalog';

/** Max edits retained in the undo stack. */
const HISTORY_LIMIT = 100;
let seq = 0;

/** Clamp a cursor into a document's grid (or the 60×40 default when empty). */
function clampToDoc(cursor: CursorPos, doc: TactileDocument | null): CursorPos {
  const resolution = doc?.resolution ?? '60x40';
  return clampCursor(cursor, RESOLUTION_DIMS[resolution]);
}

/** Current raised state of a cell (index-first, falls back to search). */
function cellActive(doc: TactileDocument, x: number, y: number): boolean {
  const { width } = RESOLUTION_DIMS[doc.resolution];
  const cell = doc.cells[y * width + x];
  if (cell && cell.x === x && cell.y === y) return cell.active;
  return Boolean(doc.cells.find((c) => c.x === x && c.y === y)?.active);
}

/** Wrap new cells into an updated document (recomputes quality + timestamp). */
function withCells(doc: TactileDocument, cells: TactileCell[]): TactileDocument {
  return { ...doc, cells, quality: computeQuality(cells, doc.resolution), updatedAt: new Date().toISOString() };
}

function blankDoc(resolution: TactileResolution = '60x40'): TactileDocument {
  const now = new Date().toISOString();
  return {
    id: `doc-draw-${++seq}`,
    title: '새 촉각그래픽',
    resolution,
    cells: createEmptyGrid(resolution),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply an edit as a {@link DocumentCommand} through the single canonical path:
 * filters no-op changes (no history noise), applies forward, and either pushes
 * a new command or merges into the active drag stroke. A new edit clears redo.
 */
function commitEdit(
  state: AppState,
  rawChanges: CellChange[],
  meta: { label: string; strokeId?: string },
): AppState {
  const changes = effectiveChanges(rawChanges);
  if (changes.length === 0) return state; // nothing actually changed

  const base = state.document ?? blankDoc(state.context.gridSize);
  const document = withCells(base, applyChanges(base.cells, changes, 'forward'));

  let past = state.history.past;
  const top = past[past.length - 1];
  if (meta.strokeId && top?.strokeId === meta.strokeId) {
    const merged: DocumentCommand = {
      ...top,
      changes: mergeStrokeChanges(top.changes, changes),
      timestamp: document.updatedAt,
    };
    past = [...past.slice(0, -1), merged];
  } else {
    const command: DocumentCommand = {
      id: `cmd-${++seq}`,
      label: meta.label,
      timestamp: document.updatedAt,
      strokeId: meta.strokeId,
      changes,
    };
    past = [...past, command];
    if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT);
  }

  return {
    ...state,
    document,
    canvasStatus: state.canvasStatus === 'empty' ? 'converted' : state.canvasStatus,
    history: { past, future: [] },
  };
}

/** Announcement text for an undo/redo of a command. */
function describeHistory(lang: Language, cmd: DocumentCommand, dir: 'undo' | 'redo'): string {
  const s = A11Y[lang];
  if (cmd.changes.length === 1) {
    const c = cmd.changes[0];
    const cellState: CellState = (dir === 'undo' ? c.before : c.after) ? 'raised' : 'lowered';
    return dir === 'undo' ? s.undoOne(c.y + 1, c.x + 1, cellState) : s.redoOne(c.y + 1, c.x + 1, cellState);
  }
  return dir === 'undo' ? s.undoMany(cmd.changes.length) : s.redoMany(cmd.changes.length);
}

export interface LogEntry {
  id: string;
  /** HH:MM timestamp string. */
  time: string;
  channel: 'convert' | 'dotpad' | 'save';
  message: string;
  tone: 'info' | 'success' | 'error';
}

export interface AppState {
  dotpadStatus: DotPadStatus;
  deviceName: string | null;
  canvasStatus: CanvasStatus;
  sendStatus: SendStatus;
  document: TactileDocument | null;
  sourceImageName: string | null;
  /** The imported image file, kept for (re)conversion. Runtime-only. */
  importedFile: File | null;
  importError: string | null;
  logs: LogEntry[];
  /** Latest human-readable message for the aria-live region. */
  announcement: string;
  /** Transient result of the last command, shown as a toast (aria-live). */
  commandResult: { id: string; message: string; tone: 'success' | 'error' } | null;
  /** UI language (KO default). Drives i18n + a11y announcements. */
  language: Language;
  /** Optional Korean/English TTS readout for the grid editor. Off by default
   * so screen-reader users are not double-announced. */
  ttsEnabled: boolean;
  /** Shared cell cursor position — owned by the canvas editor, mirrored in the
   * BottomPanel status bar. */
  cursor: CursorPos;
  /** Active editing tool (LeftRail). `cursor` = keyboard navigation default. */
  activeTool: ToolId;
  /** Shape tools fill their interior when true, otherwise draw the outline. */
  shapeFill: boolean;
  /** Select tool copies the region on commit when true, otherwise moves it. */
  selectCopy: boolean;
  /** Undo/redo command stacks (spec F1.9). */
  history: { past: DocumentCommand[]; future: DocumentCommand[] };
  /** Inherited Tactile World entry context (spec §B). Empty for direct use. */
  context: TactileStudioContext;
  /** An image-conversion preset armed for the next image import. Pre-fills the
   * ImageImportPanel; generates no cells until the user converts an image. */
  pendingConversionPreset: PendingConversionPreset | null;
}

export const initialState: AppState = {
  dotpadStatus: 'disconnected',
  deviceName: null,
  canvasStatus: 'empty',
  sendStatus: 'idle',
  document: null,
  sourceImageName: null,
  importedFile: null,
  importError: null,
  logs: [],
  announcement: '',
  commandResult: null,
  language: 'ko',
  ttsEnabled: false,
  cursor: { x: 0, y: 0 },
  activeTool: 'cursor',
  shapeFill: false,
  selectCopy: false,
  history: { past: [], future: [] },
  context: {},
  pendingConversionPreset: null,
};

export type Action =
  | { type: 'dotpad/status'; status: DotPadStatus; deviceName?: string | null }
  | { type: 'import/start'; name: string; file: File }
  | { type: 'document/convert-image'; resolution: TactileResolution; active: CursorPos[] }
  | { type: 'import/error'; message: string }
  | { type: 'convert/start' }
  | { type: 'convert/done'; document: TactileDocument }
  | { type: 'document/generate'; document: TactileDocument; isFallback: boolean }
  | { type: 'document/seed'; document: TactileDocument; message: string }
  | { type: 'send/status'; status: SendStatus }
  | { type: 'canvas/reset' }
  | { type: 'document/toggle-cell'; x: number; y: number }
  | { type: 'document/paint-cell'; x: number; y: number; value: boolean; strokeId?: string }
  | { type: 'document/paint-cells'; cells: CursorPos[]; value: boolean }
  | { type: 'document/set-cells'; cells: { x: number; y: number; value: boolean }[] }
  | { type: 'document/clear-all' }
  | { type: 'document/invert' }
  | { type: 'document/fit-grid' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'editor/cursor'; x: number; y: number }
  | { type: 'tool/set'; tool: ToolId }
  | { type: 'shape/fill'; enabled: boolean }
  | { type: 'select/copy'; enabled: boolean }
  | { type: 'context/apply'; context: TactileStudioContext }
  | { type: 'preset/arm'; preset: PendingConversionPreset }
  | { type: 'preset/clear' }
  | { type: 'language/set'; language: Language }
  | { type: 'tts/set'; enabled: boolean }
  | { type: 'log'; entry: Omit<LogEntry, 'id' | 'time'> }
  | { type: 'announce'; message: string }
  | { type: 'command/result'; message: string; tone: 'success' | 'error' }
  | { type: 'command/result-clear' };

let logSeq = 0;
function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function withLog(state: AppState, entry: Omit<LogEntry, 'id' | 'time'>): AppState {
  const log: LogEntry = { id: `log-${++logSeq}`, time: nowHM(), ...entry };
  return { ...state, logs: [...state.logs, log], announcement: entry.message };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'dotpad/status': {
      const deviceName =
        action.deviceName !== undefined ? action.deviceName : state.deviceName;
      const next = { ...state, dotpadStatus: action.status, deviceName };
      if (action.status === 'connected') {
        return withLog(
          { ...next, sendStatus: state.document ? 'ready' : 'idle' },
          {
            channel: 'dotpad',
            message: `Dot Pad 연결됨${deviceName ? ` · ${deviceName}` : ''}`,
            tone: 'success',
          },
        );
      }
      if (action.status === 'disconnected') {
        return withLog(
          { ...next, deviceName: null, sendStatus: 'idle' },
          { channel: 'dotpad', message: 'Dot Pad 연결 해제됨', tone: 'info' },
        );
      }
      if (action.status === 'error') {
        return withLog(next, {
          channel: 'dotpad',
          message: 'Dot Pad 연결 실패',
          tone: 'error',
        });
      }
      return { ...next, announcement: 'Dot Pad 연결 중' };
    }

    case 'import/start':
      return withLog(
        {
          ...state,
          sourceImageName: action.name,
          importedFile: action.file,
          importError: null,
          canvasStatus: 'image-imported',
        },
        { channel: 'convert', message: `이미지 가져오기 완료 · ${action.name}`, tone: 'success' },
      );

    case 'document/convert-image': {
      // Real image conversion (Phase 2): open a fresh blank grid at the target
      // resolution, then stamp the converted pixels as ONE undoable command —
      // canonical path, so export/DotPad and undo/redo all work. History resets
      // for the new canvas; the conversion itself is the first undoable step.
      const now = new Date().toISOString();
      const base: TactileDocument = {
        id: `doc-img-${++seq}`,
        title: (state.sourceImageName ?? '가져온 이미지').replace(/\.[^.]+$/, ''),
        resolution: action.resolution,
        cells: createEmptyGrid(action.resolution),
        sourceImageName: state.sourceImageName ?? undefined,
        createdAt: now,
        updatedAt: now,
      };
      const seeded: AppState = {
        ...state,
        document: base,
        canvasStatus: 'converted',
        sendStatus: state.dotpadStatus === 'connected' ? 'ready' : 'idle',
        cursor: clampToDoc(state.cursor, base),
        history: { past: [], future: [] },
        // The armed preset has now been consumed by this conversion.
        pendingConversionPreset: null,
      };
      const changes: CellChange[] = action.active.map(({ x, y }) => ({ x, y, before: false, after: true }));
      const committed = commitEdit(seeded, changes, { label: 'image' });
      return withLog(committed, {
        channel: 'convert',
        message: `${action.resolution} 이미지 변환 완료 · 점 ${action.active.length}개`,
        tone: 'success',
      });
    }

    case 'import/error':
      return { ...state, importError: action.message, announcement: action.message };

    case 'convert/start':
      return withLog(
        { ...state, canvasStatus: 'converting' },
        { channel: 'convert', message: '60×40 변환 시작', tone: 'info' },
      );

    case 'convert/done':
      return withLog(
        {
          ...state,
          document: action.document,
          canvasStatus: 'converted',
          sendStatus: state.dotpadStatus === 'connected' ? 'ready' : 'idle',
          // Keep the cursor valid for the new grid (stable when size is unchanged).
          cursor: clampToDoc(state.cursor, action.document),
          // A finished document supersedes any armed conversion preset.
          pendingConversionPreset: null,
        },
        { channel: 'convert', message: '60×40 변환 완료', tone: 'success' },
      );

    case 'document/generate': {
      // Command-based generation (v1). A fresh generated draft opens as a new
      // canonical document — editable, undoable, exportable, sendable — exactly
      // like a converted image. History resets (the draft is the starting point);
      // any armed conversion preset is superseded.
      const s = A11Y[state.language];
      const next: AppState = {
        ...state,
        document: action.document,
        canvasStatus: 'converted',
        sendStatus: state.dotpadStatus === 'connected' ? 'ready' : 'idle',
        cursor: clampToDoc(state.cursor, action.document),
        history: { past: [], future: [] },
        pendingConversionPreset: null,
      };
      const message = action.isFallback ? s.generationFallback : s.generationSuccess;
      return withLog(next, { channel: 'convert', message, tone: 'success' });
    }

    case 'document/seed': {
      // Seed an existing corpus (DTMS library) graphic as the editable starting
      // point — same canonical path as `document/generate` (fresh document,
      // history reset), with a corpus-specific announcement. Single withLog =
      // one live-region announcement (no double readout).
      const next: AppState = {
        ...state,
        document: action.document,
        canvasStatus: 'converted',
        sendStatus: state.dotpadStatus === 'connected' ? 'ready' : 'idle',
        cursor: clampToDoc(state.cursor, action.document),
        history: { past: [], future: [] },
        pendingConversionPreset: null,
      };
      return withLog(next, { channel: 'convert', message: action.message, tone: 'success' });
    }

    case 'send/status': {
      const canvasStatus: CanvasStatus =
        action.status === 'sending'
          ? 'sending'
          : action.status === 'sent'
            ? 'sent'
            : action.status === 'error'
              ? 'error'
              : state.canvasStatus;
      if (action.status === 'sending')
        return withLog(
          { ...state, sendStatus: 'sending', canvasStatus },
          { channel: 'dotpad', message: 'Dot Pad 전송 시작', tone: 'info' },
        );
      if (action.status === 'sent')
        return withLog(
          { ...state, sendStatus: 'sent', canvasStatus },
          { channel: 'dotpad', message: 'Dot Pad 전송 완료', tone: 'success' },
        );
      if (action.status === 'error')
        return withLog(
          { ...state, sendStatus: 'error', canvasStatus },
          { channel: 'dotpad', message: '전송 실패', tone: 'error' },
        );
      return { ...state, sendStatus: action.status };
    }

    case 'canvas/reset':
      return {
        ...state,
        canvasStatus: 'empty',
        document: null,
        sourceImageName: null,
        importedFile: null,
        importError: null,
        sendStatus: state.dotpadStatus === 'connected' ? 'idle' : 'idle',
        pendingConversionPreset: null,
      };

    case 'document/toggle-cell': {
      // Flip a single cell through the command path so it is undoable. Seeds a
      // blank grid on an empty canvas so drawing can start.
      const before = state.document ? cellActive(state.document, action.x, action.y) : false;
      return commitEdit(state, [{ x: action.x, y: action.y, before, after: !before }], { label: 'toggle' });
    }

    case 'document/paint-cell': {
      // Pen (value=true) / Eraser (value=false). No-op when already at value
      // (filtered by commitEdit → no history noise). strokeId groups a drag.
      const before = state.document ? cellActive(state.document, action.x, action.y) : false;
      return commitEdit(
        state,
        [{ x: action.x, y: action.y, before, after: action.value }],
        { label: action.value ? 'pen' : 'eraser', strokeId: action.strokeId },
      );
    }

    case 'document/paint-cells': {
      // Generic multi-cell edit — the Line and Shape tools rasterize in the
      // geometry layer and commit the resulting cells here as ONE command, so
      // the whole shape undoes/redoes in a single step. The reducer stays free
      // of geometry; no-op cells are filtered by commitEdit.
      const doc = state.document;
      const changes = action.cells.map(({ x, y }) => ({
        x,
        y,
        before: doc ? cellActive(doc, x, y) : false,
        after: action.value,
      }));
      return commitEdit(state, changes, { label: 'shape' });
    }

    case 'document/set-cells': {
      // Per-cell target values (Select move/copy) committed as ONE command.
      const doc = state.document;
      const changes = action.cells.map(({ x, y, value }) => ({
        x,
        y,
        before: doc ? cellActive(doc, x, y) : false,
        after: value,
      }));
      return commitEdit(state, changes, { label: 'select' });
    }

    case 'document/clear-all': {
      // Set every raised cell to no dot — one command. Confirmation is handled
      // in the UI before dispatch (destructive). Announces via the global region.
      const doc = state.document;
      if (!doc) return { ...state, announcement: A11Y[state.language].quickNothing };
      const changes: CellChange[] = doc.cells
        .filter((c) => c.active)
        .map((c) => ({ x: c.x, y: c.y, before: true, after: false }));
      if (changes.length === 0) return { ...state, announcement: A11Y[state.language].quickNothing };
      const next = commitEdit(state, changes, { label: 'clear-all' });
      return { ...next, announcement: A11Y[state.language].clearedDone(changes.length) };
    }

    case 'document/invert': {
      // Flip every cell (dot present ⇄ no dot) — one command.
      const doc = state.document;
      if (!doc) return { ...state, announcement: A11Y[state.language].quickNothing };
      const changes: CellChange[] = doc.cells.map((c) => ({ x: c.x, y: c.y, before: c.active, after: !c.active }));
      const next = commitEdit(state, changes, { label: 'invert' });
      return { ...next, announcement: A11Y[state.language].invertedDone(changes.length) };
    }

    case 'document/fit-grid': {
      // Center the raised content in the grid (translate only) — one command.
      const doc = state.document;
      if (!doc) return { ...state, announcement: A11Y[state.language].quickNothing };
      const active = doc.cells.filter((c) => c.active).map((c) => ({ x: c.x, y: c.y }));
      const targets = fitToGridChanges(active, RESOLUTION_DIMS[doc.resolution]);
      const changes: CellChange[] = targets.map(({ x, y, value }) => ({
        x,
        y,
        before: cellActive(doc, x, y),
        after: value,
      }));
      if (effectiveChanges(changes).length === 0)
        return { ...state, announcement: A11Y[state.language].quickNothing };
      const next = commitEdit(state, changes, { label: 'fit-grid' });
      return { ...next, announcement: A11Y[state.language].fitGridDone };
    }

    case 'history/undo': {
      const { past, future } = state.history;
      if (past.length === 0 || !state.document)
        return { ...state, announcement: A11Y[state.language].nothingToUndo };
      const cmd = past[past.length - 1];
      const document = withCells(state.document, applyChanges(state.document.cells, cmd.changes, 'inverse'));
      const first = cmd.changes[0];
      return {
        ...state,
        document,
        history: { past: past.slice(0, -1), future: [cmd, ...future].slice(0, HISTORY_LIMIT) },
        cursor: first ? clampToDoc({ x: first.x, y: first.y }, document) : state.cursor,
        announcement: describeHistory(state.language, cmd, 'undo'),
      };
    }

    case 'history/redo': {
      const { past, future } = state.history;
      if (future.length === 0 || !state.document)
        return { ...state, announcement: A11Y[state.language].nothingToRedo };
      const cmd = future[0];
      const document = withCells(state.document, applyChanges(state.document.cells, cmd.changes, 'forward'));
      const first = cmd.changes[0];
      return {
        ...state,
        document,
        history: { past: [...past, cmd].slice(-HISTORY_LIMIT), future: future.slice(1) },
        cursor: first ? clampToDoc({ x: first.x, y: first.y }, document) : state.cursor,
        announcement: describeHistory(state.language, cmd, 'redo'),
      };
    }

    case 'editor/cursor':
      return { ...state, cursor: clampToDoc({ x: action.x, y: action.y }, state.document) };

    case 'tool/set':
      return { ...state, activeTool: action.tool };

    case 'shape/fill':
      return { ...state, shapeFill: action.enabled };

    case 'select/copy':
      return { ...state, selectCopy: action.enabled };

    case 'preset/arm':
      // Arm a conversion preset for the next image import. Does NOT create a
      // document or change canvas status — the empty state stays interactive and
      // the ImageImportPanel pre-fills from this once an image is imported.
      return {
        ...state,
        pendingConversionPreset: action.preset,
        announcement: A11Y[state.language].conversionPresetSelected(action.preset.title[state.language]),
      };

    case 'preset/clear':
      return { ...state, pendingConversionPreset: null };

    case 'context/apply': {
      // Inherit the safe parts of the entry context: language, and grid size
      // for the next new document. The rest is stored for adapters/UI to read.
      const ctx = action.context;
      return {
        ...state,
        context: ctx,
        language: ctx.lang ?? state.language,
      };
    }

    case 'language/set':
      return { ...state, language: action.language };

    case 'tts/set':
      return { ...state, ttsEnabled: action.enabled };

    case 'log':
      return withLog(state, action.entry);

    case 'announce':
      return { ...state, announcement: action.message };

    case 'command/result': {
      // Log it, but leave `announcement` untouched — the toast (role=status)
      // is the single live-region announcer for command results.
      const log: LogEntry = {
        id: `log-${++logSeq}`,
        time: nowHM(),
        channel: 'convert',
        message: action.message,
        tone: action.tone === 'success' ? 'success' : 'error',
      };
      return {
        ...state,
        logs: [...state.logs, log],
        commandResult: { id: `cmd-${++logSeq}`, message: action.message, tone: action.tone },
      };
    }

    case 'command/result-clear':
      return { ...state, commandResult: null };

    default:
      return state;
  }
}

export interface AppStore {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export const AppContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const store = useContext(AppContext);
  if (!store) throw new Error('useAppStore must be used within AppContext.Provider');
  return store;
}

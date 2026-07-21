// src/react/hooks/useKeyboardShortcuts.ts
//
// Global keyboard shortcuts: undo/redo (Ctrl/Cmd+Z, +Shift+Z, +Y) plus, as of
// this pass, the tool-picking shortcuts ported from the monolith's canonical
// toolKeys() map (index.html) -- P/E/L/R/O/G/F/S/T/V for
// pen/eraser/line/rect/ellipse/poly/fill/select/text/cursor. This is the
// SAME id->key mapping vanilla uses, so a shortcut means the same thing in
// both apps.
//
// Zoom shortcuts (Ctrl/Cmd +/-/0) now live here too, ported once
// EditorStore grew zoomIn/zoomOut/zoomReset (see editor-store.ts's zoom-
// preset doc comment) and StudioCanvas grew a ZoomControls pill to display
// the result -- same id->action mapping as vanilla's onKey (index.html):
// `=`/`+`/NumpadAdd -> zoomIn, `-`/`_`/NumpadSubtract -> zoomOut, `0` ->
// zoomReset. Deliberately still NOT stealing plain `=`/`-`/`0` (no modifier)
// the way tool letters are stolen above -- those are common text-input
// characters, and vanilla itself only binds them with Ctrl/Cmd held.
//
// STILL NOT ported here (tracked as a separate, larger gap -- needs UI that
// doesn't exist in this package yet):
//   - Space (toggle dot under keyboard cursor) / arrow-key cell nudge / Enter
//     (close polygon) -- monolith's accessibility-mode canvas keyboard nav,
//     which depends on a cell-cursor position (state.cx/cy) this port's
//     core state doesn't track yet
// Ctrl/Cmd+S (save) and "?" (help toggle) are NOT here either -- both need
// EditorBody-local state/services this hook doesn't have, so they get their
// own dedicated listeners in TactileStudioEditor.tsx (same reasoning
// documented there for Ctrl+S already).
//
// Ignores events with a text-input target so typing "p"/"e"/etc. in the
// text-tool popover or a dialog input never triggers a tool switch --same
// guard the undo/redo path already used, now shared by both.

import { useEffect } from 'react';
import { useEditorStore } from './useEditorStore.js';
import { useTool } from './useTool.js';
import type { ToolId } from '../../core/state/types.js';
import type { StudioLabels } from '../types/public-api.js';

// Canonical tool->key map -- identical ids/letters to vanilla's toolKeys()
// (index.html), so this is a port, not a reinterpretation.
const TOOL_KEYS: Record<string, ToolId> = {
  p: 'pen', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse',
  g: 'poly', f: 'fill', s: 'select', t: 'text', v: 'cursor',
};

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useKeyboardShortcuts(labels?: StudioLabels) {
  const { store } = useEditorStore();
  const { setTool } = useTool();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod) {
        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          if (store.redo()) { const msg = (labels?.aRedo as string) || 'Redone'; store.announce(msg); store.toastMsg(msg); }
        } else if (key === 'z') {
          e.preventDefault();
          if (store.undo()) { const msg = (labels?.aUndo as string) || 'Undone'; store.announce(msg); store.toastMsg(msg); }
        } else if (key === 'y') {
          e.preventDefault();
          if (store.redo()) { const msg = (labels?.aRedo as string) || 'Redone'; store.announce(msg); store.toastMsg(msg); }
        } else if (key === '=' || key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          store.zoomIn();
        } else if (key === '-' || key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          store.zoomOut();
        } else if (key === '0') {
          e.preventDefault();
          store.zoomReset();
        }
        return;
      }
      // Tool shortcuts -- only plain letter keys, no modifier (matches
      // vanilla's onKey: `if (!e.ctrlKey && !e.metaKey && tools[k])`).
      const toolId = TOOL_KEYS[key];
      if (toolId) {
        e.preventDefault();
        setTool(toolId);
        const names = labels?.toolNames as Record<string, string> | undefined;
        const name = names?.[toolId] || toolId;
        const msg = (labels?.aToolSel as string)?.replace('{tool}', name) || `Tool: ${name}`;
        store.announce(msg);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store, setTool, labels]);
}

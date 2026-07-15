// src/react/hooks/useKeyboardShortcuts.ts
//
// Minimal shortcut set for this pass (documented in known-issues.md #5 as
// partial): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (and Ctrl+Y) redo. The
// monolith's full shortcut registry (per-tool keys, Cmd-vs-Ctrl display
// logic via _isMac(), tooltips showing the shortcut) is NOT ported yet.
// Ignores events with a text-input target so typing "z" in the text-tool
// popover or a future dialog input never triggers undo/redo.
//
// BUG FIX (found while wiring the undo/redo toast, see ui/toast/Toast.tsx):
// this hook called store.undo()/store.redo() directly and never announced
// anything, unlike Toolbar's doUndo/doRedo which also call
// store.announce(...). That meant the keyboard path silently skipped BOTH
// the screen-reader live region AND (now) the visual toast -- a real,
// user-facing parity gap versus the monolith (whose undo()/redo() announce
// unconditionally, regardless of trigger source), not something
// intentionally deferred. Fixed by accepting the same `labels` the toolbar
// already receives and mirroring its announce+toastMsg pair here. Only
// fires when store.undo()/redo() actually changed something (returns
// true) -- mirrors the monolith's own early-return on an empty
// undo/redo stack, so Ctrl+Z with nothing to undo stays silent.

import { useEffect } from 'react';
import { useEditorStore } from './useEditorStore.js';
import type { StudioLabels } from '../types/public-api.js';

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useKeyboardShortcuts(labels?: StudioLabels) {
  const { store } = useEditorStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (store.redo()) { const msg = (labels?.aRedo as string) || 'Redone'; store.announce(msg); store.toastMsg(msg); }
      } else if (key === 'z') {
        e.preventDefault();
        if (store.undo()) { const msg = (labels?.aUndo as string) || 'Undone'; store.announce(msg); store.toastMsg(msg); }
      } else if (key === 'y') {
        e.preventDefault();
        if (store.redo()) { const msg = (labels?.aRedo as string) || 'Redone'; store.announce(msg); store.toastMsg(msg); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store, labels]);
}

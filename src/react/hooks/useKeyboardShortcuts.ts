// src/react/hooks/useKeyboardShortcuts.ts
//
// Minimal shortcut set for this pass (documented in known-issues.md #5 as
// partial): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (and Ctrl+Y) redo. The
// monolith's full shortcut registry (per-tool keys, Cmd-vs-Ctrl display
// logic via _isMac(), tooltips showing the shortcut) is NOT ported yet.
// Ignores events with a text-input target so typing "z" in the text-tool
// popover or a future dialog input never triggers undo/redo.

import { useEffect } from 'react';
import { useEditorStore } from './useEditorStore.js';

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useKeyboardShortcuts() {
  const { store } = useEditorStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) { e.preventDefault(); store.redo(); }
      else if (key === 'z') { e.preventDefault(); store.undo(); }
      else if (key === 'y') { e.preventDefault(); store.redo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store]);
}

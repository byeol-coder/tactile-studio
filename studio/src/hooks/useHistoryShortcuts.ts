import { useEffect } from 'react';
import { useAppStore } from '../app/appState';

/** True for editable text targets we must not hijack (inputs, textareas, CE). */
function isTextField(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable === true;
}

/**
 * App-level undo/redo shortcuts (spec F1.9 §3):
 *   Ctrl/Cmd+Z → undo · Ctrl/Cmd+Shift+Z → redo · Ctrl+Y → redo.
 *
 * A single window listener (no bubbling duplication); skipped inside text
 * fields so the browser's own text undo keeps working. The canvas key handler
 * doesn't claim these keys, so they reach here exactly once. Undo/redo result
 * text is announced via the global aria-live region (set by the reducer).
 */
export function useHistoryShortcuts() {
  const { dispatch } = useAppStore();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (isTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'history/redo' : 'history/undo' });
      } else if (key === 'y') {
        e.preventDefault();
        dispatch({ type: 'history/redo' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}

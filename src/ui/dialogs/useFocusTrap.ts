// src/ui/dialogs/useFocusTrap.ts
//
// A small, reusable focus trap for modal dialogs: while `open`, Tab/Shift+Tab
// cycle only among the dialog's own focusable elements (never escaping to
// the page behind it), and closing restores focus to whatever had it before
// the dialog opened. Used by ConfirmDialog and ImportDialog.

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(open: boolean, initialFocusRef?: RefObject<HTMLElement>) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;

    const container = containerRef.current;
    const focusFirst = () => {
      if (initialFocusRef?.current) { initialFocusRef.current.focus(); return; }
      const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.[0]?.focus();
    };
    // Defer one tick so the dialog's own contents (rendered this same
    // render) are in the DOM before we query for focusable elements.
    const t = setTimeout(focusFirst, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

  return containerRef;
}

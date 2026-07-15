// src/ui/toast/Toast.tsx
//
// Verbatim-intent port of the monolith's bottom-center visual toast (the
// `sc-if value="{{ toastOn }}"` block): a dark pill with a checkmark icon,
// shown for undo/redo feedback and auto-cleared via EditorStore.toastMsg()
// (see editor-store.ts). Renders nothing when snapshot.toast is null.
//
// SCOPE NOTE: this is intentionally a single-purpose component, not a
// general-purpose toast system. The monolith's own toastMsg() is used for
// far more than undo/redo (export, save errors, corpus-load failures,
// DotPad send, ...), but this port only wires it to undo/redo so far (see
// Toolbar.tsx doUndo/doRedo, useKeyboardShortcuts.ts) -- reusing it for
// those other cases is future work, not done here. If/when a second real
// consumer shows up, that's the point to generalize this into a queue/
// stack-based system; building that now for one consumer would be
// speculative.
//
// ADAPTATION: the monolith's toast has `animation: tsUp 0.25s ease-out`,
// which depends on a global `@keyframes tsUp` stylesheet rule. This port's
// entire UI is inline-styled with no injected global CSS anywhere (same
// documented limitation as RecoveryBanner/EmptyStateHint and the missing
// @media support noted in docs/known-issues.md #8) -- an inline `animation`
// property referencing a keyframe name that doesn't exist anywhere is
// inert, so it's omitted here rather than shipping a no-op style.

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';

export function Toast() {
  const { snapshot } = useEditorStore();
  if (!snapshot.toast) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', zIndex: 90,
        background: '#1E1C1A', color: '#fff',
        fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
        fontSize: 13.5, fontWeight: 600,
        borderRadius: 100, padding: '11px 22px', display: 'flex', alignItems: 'center', gap: 9,
        boxShadow: '0 8px 8px -4px rgba(10,13,18,0.04), 0 20px 24px -4px rgba(10,13,18,0.08)',
      }}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#7CC96B', flex: 'none' }}>
        <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {snapshot.toast}
    </div>
  );
}

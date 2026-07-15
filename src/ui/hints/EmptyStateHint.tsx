// src/ui/hints/EmptyStateHint.tsx
//
// Verbatim-intent port of the monolith's first-run empty-canvas hint (the
// `sc-if value="{{ emptyHint }}"` block). Renders nothing unless
// snapshot.emptyHintOn is true (see EditorStore.computeEmptyHintOn for the
// exact condition, including its one deliberate adaptation from the
// monolith's !fileName check). Naturally clears itself the moment the user
// draws, adds a page, or loads anything -- the explicit dismiss button is
// just an escape hatch for someone exploring the UI before drawing.

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface EmptyStateHintProps {
  labels?: StudioLabels;
}

export function EmptyStateHint({ labels }: EmptyStateHintProps) {
  const { snapshot, store } = useEditorStore();
  if (!snapshot.emptyHintOn) return null;

  const message = (labels?.emptyHintMsg as string) || 'Draw with the Pen, or use Create above to start from an image or a command.';
  const closeLabel = (labels?.close as string) || 'Close';

  return (
    <div
      role="status"
      style={{
        // NOTE: the monolith uses position:absolute inside its own
        // known-relative canvas container; this component is meant to be
        // embedded inside an arbitrary host layout, so `fixed` is used
        // instead -- same adaptation as RecoveryBanner.
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 19,
        pointerEvents: 'none',
        maxWidth: 520, display: 'flex', alignItems: 'center', gap: 10,
        background: '#FFFFFF', color: 'var(--ts-ink, #1E1C1A)', border: '1px solid var(--ts-line, #ECE6DC)',
        borderRadius: 10, padding: '10px 12px',
        boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 28px -14px rgba(16,24,40,0.14)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 24, height: 24, borderRadius: 8, background: 'rgba(196,61,0,0.10)',
          display: 'grid', placeItems: 'center', color: 'var(--ts-primary, #C43D00)', flex: 'none',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, color: 'var(--ts-muted, #57534E)' }}>{message}</span>
      <button
        type="button"
        onClick={() => store.dismissEmptyHint()}
        aria-label={closeLabel}
        style={{
          pointerEvents: 'auto', flex: 'none', width: 24, height: 24, border: 'none', borderRadius: 7,
          background: 'transparent', color: 'var(--ts-muted, #57534E)', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

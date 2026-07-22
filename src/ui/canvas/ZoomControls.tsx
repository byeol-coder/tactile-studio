// src/ui/canvas/ZoomControls.tsx
//
// Zoom pill: zoom-out / percentage-that-doubles-as-reset / zoom-in, verbatim
// UX port of the monolith's canvas-view-controls zoom segment (index.html,
// the ts-zoom-btn group around zoomOut/zoomPct/zoomIn). NOT ported: the
// grid-toggle/grid-strength/keyboard-assist buttons that share that same
// pill in vanilla -- those are separate features with their own scope, not
// part of this pass. Also not pixel-identical (circular 30px buttons on a
// rounded strip with custom-positioned tooltips) -- reuses this package's
// existing IconButton (rounded-8, native-adjacent styling, already wired to
// the shared Tooltip component) rather than hand-rolling vanilla's exact
// circular button CSS, same "verbatim behavior, adapted chrome" tradeoff
// this migration has made elsewhere (see TactileStudioEditor.tsx's own doc
// comment on deferred pixel-level polish). Colors/background/border/radius
// all reuse the existing --ts-bg/--ts-line design tokens (see icons.ts and
// ConfirmDialog.tsx/HelpDialog.tsx for the same floating-panel convention)
// -- no new tokens introduced. The plus/minus glyphs are sourced from
// Tabler Icons (see icons.ts's own doc comment) rather than hand-drawn,
// per this project's own stated icon-sourcing convention for anything
// outside the original Figma ICONS map.
//
// Reads/writes zoom via useZoom() (thin wrapper over EditorStore's
// zoomIn/zoomOut/zoomReset preset-stepping methods) -- see that hook and
// editor-store.ts's own doc comment for what IS and is NOT ported (the
// preset values are verbatim; scroll-anchoring math and the wheel handler
// live in StudioCanvas.tsx alongside the actual scrollable viewport).

import React from 'react';
import { useZoom } from '../../react/hooks/useZoom.js';
import { IconButton } from '../toolbar/IconButton.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface ZoomControlsProps {
  labels?: StudioLabels;
}

export function ZoomControls({ labels }: ZoomControlsProps) {
  const { zoom, canZoomIn, canZoomOut, zoomIn, zoomOut, zoomReset } = useZoom();

  const zoomOutLabel = (labels?.zoomOutL as string) || 'Zoom out';
  const zoomInLabel = (labels?.zoomInL as string) || 'Zoom in';
  const zoomResetLabel = (labels?.zoomResetL as string) || 'Reset to 100%';
  const zoomGroupLabel = (labels?.zoomLabel as string) || 'Zoom canvas';

  return (
    <div
      role="group"
      aria-label={zoomGroupLabel}
      style={{
        position: 'absolute', right: 8, bottom: 8, zIndex: 16,
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: 'var(--ts-surface, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)',
        borderRadius: 100, padding: 4,
        boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 4px 10px -4px rgba(16,24,40,0.16)',
      }}
    >
      <IconButton icon="minus" label={zoomOutLabel} keyHint="Ctrl/Cmd −" disabled={!canZoomOut} onClick={zoomOut} />
      <button
        type="button"
        onClick={zoomReset}
        aria-label={zoomResetLabel}
        aria-keyshortcuts="Meta+0 Control+0"
        title={zoomResetLabel}
        style={{
          minWidth: 48, height: 32, padding: '0 6px', border: 'none', borderRadius: 100,
          background: 'transparent', color: 'var(--ts-ink, #1E1C1A)', fontWeight: 700,
          fontSize: 13, fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton icon="plus" label={zoomInLabel} keyHint="Ctrl/Cmd +" disabled={!canZoomIn} onClick={zoomIn} />
    </div>
  );
}

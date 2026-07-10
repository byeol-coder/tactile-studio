// src/ui/toolbar/Toolbar.tsx
//
// Minimal tool-selection toolbar for this Phase 5 pass: the core drawing
// tools plus undo/redo. Labels come entirely from the host (no internal
// i18n, per the migration spec) with an English fallback.
//
// DEFERRED to a Phase 5 continuation (documented, not silently dropped):
// the full Figma icon set, pen/eraser thickness dropdowns, the shape-tool
// flyout, page panel, inspector, DotPad panel, dialogs, and command-panel UI.
// This toolbar proves the wiring (host labels → buttons → store) that all of
// those will reuse.

import React from 'react';
import { useTool } from '../../react/hooks/useTool.js';
import { useHistory } from '../../react/hooks/useHistory.js';
import type { ToolId } from '../../core/state/types.js';
import type { StudioLabels } from '../../react/types/public-api.js';

const TOOL_IDS: ToolId[] = ['cursor', 'pen', 'eraser', 'line', 'rect', 'ellipse', 'fill', 'select'];

const DEFAULT_TOOL_NAMES: Record<string, string> = {
  cursor: 'Cursor', pen: 'Pen', eraser: 'Eraser', line: 'Line',
  rect: 'Rectangle', ellipse: 'Ellipse', poly: 'Polygon', fill: 'Fill',
  select: 'Select', text: 'Tactile Text',
};

export interface ToolbarProps {
  labels?: StudioLabels;
}

export function Toolbar({ labels }: ToolbarProps) {
  const { tool, setTool } = useTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const names = { ...DEFAULT_TOOL_NAMES, ...(labels?.toolNames || {}) };

  return (
    <div role="toolbar" aria-label={labels?.pagesLabel ? undefined : 'Tools'} style={{ display: 'flex', gap: 4 }}>
      {TOOL_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={tool === id}
          aria-label={names[id]}
          title={names[id]}
          onClick={() => setTool(id)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--ts-line, #ECE6DC)',
            background: tool === id ? 'var(--ts-primary, #C43D00)' : 'var(--ts-surface, #FFFFFF)',
            color: tool === id ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
            cursor: 'pointer',
          }}
        >
          {names[id]}
        </button>
      ))}
      <span style={{ width: 1, background: 'var(--ts-line, #ECE6DC)', margin: '0 4px' }} />
      <button type="button" disabled={!canUndo} onClick={undo} aria-label={labels?.undo as string || 'Undo'} title={labels?.undo as string || 'Undo'}>
        ↶
      </button>
      <button type="button" disabled={!canRedo} onClick={redo} aria-label={labels?.redo as string || 'Redo'} title={labels?.redo as string || 'Redo'}>
        ↷
      </button>
    </div>
  );
}

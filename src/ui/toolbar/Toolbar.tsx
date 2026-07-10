// src/ui/toolbar/Toolbar.tsx
//
// Icon-based toolbar using the verbatim-ported ICONS map (src/ui/icons).
// Labels come entirely from the host (no internal i18n) with an English
// fallback, matching the monolith's toolNames keys exactly.
//
// STILL DEFERRED (documented in docs/known-issues.md #5): shape-tool flyout
// grouping (line/rect/ellipse/poly under one button), the pen/eraser
// thickness DROPDOWN styling (this pass uses a plain segmented 1/2/3
// control, not the dot-swatch popover), and the command-panel/corpus search.

import React from 'react';
import { useTool } from '../../react/hooks/useTool.js';
import { useHistory } from '../../react/hooks/useHistory.js';
import type { ToolId } from '../../core/state/types.js';
import type { StudioLabels } from '../../react/types/public-api.js';
import { IconButton } from './IconButton.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';

const TOOL_IDS: ToolId[] = ['cursor', 'pen', 'eraser', 'line', 'rect', 'ellipse', 'poly', 'fill', 'select', 'text'];

const TOOL_ICONS: Record<ToolId, string> = {
  cursor: 'cursor', pen: 'pen', eraser: 'eraser', line: 'line', rect: 'rect',
  ellipse: 'ellipse', poly: 'poly', fill: 'fill', select: 'select', text: 'text',
};

const DEFAULT_TOOL_NAMES: Record<string, string> = {
  cursor: 'Cursor', pen: 'Pen', eraser: 'Eraser', line: 'Line',
  rect: 'Rectangle', ellipse: 'Ellipse', poly: 'Polygon', fill: 'Fill',
  select: 'Select', text: 'Tactile Text',
};

const Divider = () => <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--ts-line, #ECE6DC)', margin: '0 4px' }} />;

export interface ToolbarProps {
  labels?: StudioLabels;
}

export function Toolbar({ labels }: ToolbarProps) {
  const { tool, setTool, strokeSize, eraserSize, setStrokeSize, setEraserSize } = useTool();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { store } = useEditorStore();
  const providedNames = labels?.toolNames || {};
  const names: Record<string, string> = { ...DEFAULT_TOOL_NAMES };
  for (const [k, v] of Object.entries(providedNames)) if (v != null) names[k] = v;

  const showThickness = tool === 'pen' || tool === 'eraser';
  const activeSize = tool === 'eraser' ? eraserSize : strokeSize;
  const setActiveSize = tool === 'eraser' ? setEraserSize : setStrokeSize;

  return (
    <div role="toolbar" aria-label="Tools" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {TOOL_IDS.map((id) => (
        <IconButton key={id} icon={TOOL_ICONS[id]} label={names[id]} pressed={tool === id} onClick={() => setTool(id)} />
      ))}

      {showThickness && (
        <>
          <Divider />
          <div role="group" aria-label={(labels?.strokeSizeLabel as string) || 'Thickness'} style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3].map((n) => {
              const sizeLabel = `${n}×${n}`;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={activeSize === n}
                  aria-label={sizeLabel}
                  title={sizeLabel}
                  onClick={() => setActiveSize(n)}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: '1px solid var(--ts-line, #ECE6DC)',
                    background: activeSize === n ? 'var(--ts-primary, #C43D00)' : 'var(--ts-surface, #FFFFFF)',
                    color: activeSize === n ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Divider />
      {/* No undo/redo icon exists in the ported ICONS map (the monolith's
          announcements for these exist — aUndo/aRedo — but no SVG path data
          was found for them; per the target stack these likely come from
          Tabler Icons, not yet sourced into src/ui/icons). Plain glyphs here
          rather than guessing at path data. */}
      <button type="button" disabled={!canUndo} onClick={undo} aria-label={(labels?.undo as string) || 'Undo'} title={(labels?.undo as string) || 'Undo'} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.4 }}>↶</button>
      <button type="button" disabled={!canRedo} onClick={redo} aria-label={(labels?.redo as string) || 'Redo'} title={(labels?.redo as string) || 'Redo'} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', cursor: canRedo ? 'pointer' : 'default', opacity: canRedo ? 1 : 0.4 }}>↷</button>

      <Divider />
      <IconButton icon="flipH" label={(labels?.flipH as string) || 'Flip horizontal'} onClick={() => store.flipHoriz()} />
      <IconButton icon="flipV" label={(labels?.flipV as string) || 'Flip vertical'} onClick={() => store.flipVert()} />
      <IconButton icon="invert" label={(labels?.invert as string) || 'Invert'} onClick={() => store.invertAll()} />
      <IconButton icon="clearAll" label={(labels?.clearAll as string) || 'Clear all'} onClick={() => store.clearAll()} />
    </div>
  );
}

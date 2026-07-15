// src/ui/toolbar/Toolbar.tsx
//
// Icon-based toolbar using the verbatim-ported ICONS map (src/ui/icons).
// Labels come entirely from the host (no internal i18n) with an English
// fallback, matching the monolith's toolNames keys exactly.
//
// Shape tools (line/rect/ellipse/poly) are grouped behind one button + caret
// flyout (verbatim UX port of the monolith's shapeGroup pattern: the main
// button reuses/shows the last-selected shape tool, the caret opens the
// full set). Thickness is a similar group (main button shows a dot/square
// glyph reflecting the CURRENT size via StrokeGroupIcon/EraserGroupIcon,
// caret opens the 1/2/3 options) instead of always-visible 1/2/3 buttons.
//
// Every action here also calls store.announce() with host-labeled text, for
// the live region (see ui/live-region/LiveRegion.tsx) — a verbatim-intent
// port of the monolith's this.say(...) calls after every state change.
//
// STILL DEFERRED (docs/known-issues.md #5): full Figma-exact spacing/
// typography and custom tooltip positioning (this pass uses native
// title="" tooltips, not the monolith's custom-positioned tip bubble).

import React from 'react';
import { useTool } from '../../react/hooks/useTool.js';
import { useHistory } from '../../react/hooks/useHistory.js';
import type { ToolId } from '../../core/state/types.js';
import type { StudioLabels } from '../../react/types/public-api.js';
import { IconButton } from './IconButton.js';
import { Flyout } from './Flyout.js';
import { StrokeGroupIcon, EraserGroupIcon } from './GroupIcons.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';

const NON_SHAPE_TOOL_IDS: ToolId[] = ['cursor', 'pen', 'eraser'];
const SHAPE_TOOL_IDS: ToolId[] = ['line', 'rect', 'ellipse', 'poly'];
const TRAILING_TOOL_IDS: ToolId[] = ['fill', 'select', 'text'];

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

  const shapeActive = SHAPE_TOOL_IDS.indexOf(tool) !== -1;
  // "last used shape tool" — falls back to 'line' like the monolith's
  // shapeShownTool, tracked via a ref-less derivation: the store already
  // remembers `tool` across renders, so we only need a fallback for when a
  // NON-shape tool is currently active.
  const lastShapeToolRef = React.useRef<ToolId>('line');
  if (shapeActive) lastShapeToolRef.current = tool;
  const shapeShownTool = lastShapeToolRef.current;

  const selectTool = (id: ToolId) => {
    setTool(id);
    store.announce(((labels?.aShape as string) || '{tool} selected').replace('{tool}', names[id]));
  };

  const showThickness = tool === 'pen' || tool === 'eraser' || shapeActive;
  const isEraser = tool === 'eraser';
  const activeSize = isEraser ? eraserSize : strokeSize;
  const setActiveSize = isEraser ? setEraserSize : setStrokeSize;
  const thicknessLabel = isEraser ? ((labels?.eraserL as string) || 'Eraser size') : ((labels?.strokeL as string) || 'Line thickness');

  // Both announce() (screen-reader live region) and toastMsg() (visible
  // pill, see ui/toast/Toast.tsx) fire together for the same event -- the
  // monolith's undo()/redo() call this.say(msg) + this.toastMsg(msg) as one
  // pair, never one without the other.
  const doUndo = () => { undo(); const msg = (labels?.aUndo as string) || 'Undone'; store.announce(msg); store.toastMsg(msg); };
  const doRedo = () => { redo(); const msg = (labels?.aRedo as string) || 'Redone'; store.announce(msg); store.toastMsg(msg); };
  const doFlipH = () => { store.flipHoriz(); store.announce((labels?.aFlipH as string) || 'Flipped horizontally'); };
  const doFlipV = () => { store.flipVert(); store.announce((labels?.aFlipV as string) || 'Flipped vertically'); };
  const doInvert = () => { store.invertAll(); store.announce((labels?.aInvert as string) || 'Inverted'); };
  const doClear = () => { store.clearAll(); store.announce((labels?.aClear as string) || 'Canvas cleared'); };

  return (
    <div role="toolbar" aria-label="Tools" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {NON_SHAPE_TOOL_IDS.map((id) => (
        <IconButton key={id} icon={TOOL_ICONS[id]} label={names[id]} pressed={tool === id} onClick={() => selectTool(id)} />
      ))}

      <Flyout
        ariaLabel={(labels?.shapesGroup as string) || 'Shape tools'}
        trigger={({ onClick, ref }) => (
          <div style={{ display: 'flex' }}>
            <IconButton
              icon={TOOL_ICONS[shapeShownTool]}
              label={shapeActive ? names[tool] : ((labels?.shapesGroup as string) || 'Shapes')}
              pressed={shapeActive}
              onClick={() => selectTool(shapeShownTool)}
            />
            <button
              ref={ref}
              type="button"
              aria-haspopup="menu"
              aria-label={((labels?.shapesGroup as string) || 'Shapes') + ' — ' + ((labels?.moreOpts as string) || 'more options')}
              onClick={onClick}
              style={{ width: 16, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ts-ink, #1E1C1A)' }}
            >
              ▾
            </button>
          </div>
        )}
      >
        {(close) => SHAPE_TOOL_IDS.map((id) => (
          <IconButton key={id} icon={TOOL_ICONS[id]} label={names[id]} pressed={tool === id} onClick={() => { selectTool(id); close(); }} />
        ))}
      </Flyout>

      {TRAILING_TOOL_IDS.map((id) => (
        <IconButton key={id} icon={TOOL_ICONS[id]} label={names[id]} pressed={tool === id} onClick={() => selectTool(id)} />
      ))}

      {showThickness && (
        <>
          <Divider />
          <Flyout
            ariaLabel={thicknessLabel}
            trigger={({ onClick, ref }) => (
              <button
                ref={ref}
                type="button"
                aria-haspopup="menu"
                aria-label={`${thicknessLabel} — ${activeSize}`}
                title={thicknessLabel}
                onClick={onClick}
                style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', color: 'var(--ts-ink, #1E1C1A)', cursor: 'pointer' }}
              >
                {isEraser ? <EraserGroupIcon size={20} activeN={activeSize} /> : <StrokeGroupIcon size={20} activeN={activeSize} />}
              </button>
            )}
          >
            {(close) => [1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={activeSize === n}
                aria-label={`${n}×${n}`}
                title={`${n}×${n}`}
                onClick={() => { setActiveSize(n); close(); }}
                style={{
                  width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6,
                  border: '1px solid var(--ts-line, #ECE6DC)',
                  background: activeSize === n ? 'var(--ts-primary, #C43D00)' : 'var(--ts-surface, #FFFFFF)',
                  color: activeSize === n ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
                  cursor: 'pointer',
                }}
              >
                {isEraser ? <EraserGroupIcon size={18} activeN={n} /> : <StrokeGroupIcon size={18} activeN={n} />}
              </button>
            ))}
          </Flyout>
        </>
      )}

      <Divider />
      {/* No undo/redo icon exists in the ported ICONS map (the monolith's
          announcements for these exist — aUndo/aRedo — but no SVG path data
          was found for them; per the target stack these likely come from
          Tabler Icons, not yet sourced into src/ui/icons). Plain glyphs here
          rather than guessing at path data. */}
      <button type="button" disabled={!canUndo} onClick={doUndo} aria-label={(labels?.undo as string) || 'Undo'} title={(labels?.undo as string) || 'Undo'} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.4 }}>↶</button>
      <button type="button" disabled={!canRedo} onClick={doRedo} aria-label={(labels?.redo as string) || 'Redo'} title={(labels?.redo as string) || 'Redo'} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', cursor: canRedo ? 'pointer' : 'default', opacity: canRedo ? 1 : 0.4 }}>↷</button>

      <Divider />
      <IconButton icon="flipH" label={(labels?.flipH as string) || 'Flip horizontal'} onClick={doFlipH} />
      <IconButton icon="flipV" label={(labels?.flipV as string) || 'Flip vertical'} onClick={doFlipV} />
      <IconButton icon="invert" label={(labels?.invert as string) || 'Invert'} onClick={doInvert} />
      <IconButton icon="clearAll" label={(labels?.clearAll as string) || 'Clear all'} onClick={doClear} />
    </div>
  );
}

// src/react/TactileStudioEditor.tsx
//
// The public, reusable editor component (Phase 5/6 target). Composition
// only — Provider owns the store, Toolbar/StudioCanvas read it via hooks.
//
// Requirements this satisfies directly:
//   - no iframe, no internal router, no Supabase import, no auth dependency
//   - no internal language switching (labels are host props, English
//     fallback only)
//   - safe mount/unmount: the store is created once per mount (see
//     TactileStudioProvider) and the device-adapter effect below cleans up
//     unconditionally on unmount
//   - host-configurable services/labels/theme via props
//   - typed public API

import React, { useEffect, useRef } from 'react';
import { TactileStudioProvider } from './TactileStudioProvider.js';
import { StudioCanvas } from '../ui/canvas/StudioCanvas.js';
import { Toolbar } from '../ui/toolbar/Toolbar.js';
import type { TactileStudioEditorProps } from './types/public-api.js';

function themeStyle(theme?: Record<string, string | undefined>): React.CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme)) if (v != null) style[k] = v;
  return style as React.CSSProperties;
}

export function TactileStudioEditor({
  initialDocument, services, labels, theme, onChange, onSave, onDirtyChange, onError, className,
}: TactileStudioEditorProps) {
  // onSave/onError are host callbacks the editor doesn't call automatically
  // yet (no save button/keyboard shortcut wired in this pass — see the
  // Phase 5 scope note); kept as refs so a host can pass fresh closures every
  // render without this component needing to resubscribe anything.
  const onSaveRef = useRef(onSave);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSaveRef.current = onSave; onErrorRef.current = onError; }, [onSave, onError]);

  // Deterministic-cleanup seam for Phase 6: once the DotPad panel wires a
  // subscribeKeys() listener against services.tactileDisplay, ITS
  // unsubscribe (not a dispose() of the whole adapter — that's host-owned)
  // belongs here. No listener is registered yet in this pass, so there is
  // nothing to clean up; this effect exists so that future wiring has one
  // place to add it rather than scattering cleanup through the tree.
  useEffect(() => {
    return () => { /* no listener registered yet — see comment above */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className} style={{ ...themeStyle(theme), display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TactileStudioProvider initialDocument={initialDocument} onChange={onChange} onDirtyChange={onDirtyChange}>
        <Toolbar labels={labels} />
        <StudioCanvas ariaLabel={(labels?.canvasAria as string) || 'Tactile drawing canvas'} />
      </TactileStudioProvider>
    </div>
  );
}

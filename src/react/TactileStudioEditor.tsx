// src/react/TactileStudioEditor.tsx
//
// The public, reusable editor component. Composition only — Provider owns
// the store, every panel below reads/writes it via hooks.
//
// Requirements this satisfies directly:
//   - no iframe, no internal router, no Supabase import, no auth dependency
//   - no internal language switching (labels are host props, English
//     fallback only)
//   - safe mount/unmount: the store is created once per mount (see
//     TactileStudioProvider); DotPadPanel disposes its adapter on unmount
//   - host-configurable services/labels/theme via props
//   - typed public API
//
// STILL DEFERRED (docs/known-issues.md #5): corpus/command-panel search,
// full Figma spacing/tooltips, focus-trap dialogs, live-region announcements
// beyond aria-live on the DotPad status line, confirm-before-delete for
// pages, PNG/SVG export.

import React, { useEffect, useRef, useState } from 'react';
import { TactileStudioProvider } from './TactileStudioProvider.js';
import { StudioCanvas } from '../ui/canvas/StudioCanvas.js';
import { Toolbar } from '../ui/toolbar/Toolbar.js';
import { PagePanel } from '../ui/panels/PagePanel.js';
import { Inspector } from '../ui/inspector/Inspector.js';
import { DotPadPanel } from '../ui/dotpad/DotPadPanel.js';
import { ImportDialog } from '../ui/dialogs/ImportDialog.js';
import { ExportMenu } from '../ui/dialogs/ExportMenu.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import type { TactileStudioEditorProps } from './types/public-api.js';

function themeStyle(theme?: Record<string, string | undefined>): React.CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme)) if (v != null) style[k] = v;
  return style as React.CSSProperties;
}

/** Triggers a browser file download for exported JSON. Pure UI convenience
 *  (mirrors the monolith's downloadBlob) — guarded for environments without
 *  URL.createObjectURL (e.g. some test runners). */
function triggerDownload(json: string, filename: string) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') return;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Internal — must render inside TactileStudioProvider to reach the store. */
function EditorBody({ services, labels }: Pick<TactileStudioEditorProps, 'services' | 'labels'>) {
  useKeyboardShortcuts();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Toolbar labels={labels} />
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setImportOpen(true)}>{(labels?.impAssetTitle as string) || 'Import'}</button>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setExportOpen((v) => !v)}>{(labels?.tExport as string) || 'Export'}</button>
          {exportOpen && services.encodeBits && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--ts-bg, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, padding: 8, zIndex: 40 }}>
              <ExportMenu
                encodeBits={services.encodeBits}
                labels={labels}
                onExport={(r) => { triggerDownload(r.json, r.filename); setExportOpen(false); }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <PagePanel labels={labels} />
        <StudioCanvas ariaLabel={(labels?.canvasAria as string) || 'Tactile drawing canvas'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Inspector labels={labels} gridFx={services.gridFx} />
          {services.tactileDisplay && <DotPadPanel adapter={services.tactileDisplay} encodeBits={services.encodeBits} labels={labels} />}
        </div>
      </div>

      <ImportDialog open={importOpen} labels={labels} onClose={() => setImportOpen(false)} />
    </div>
  );
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

  return (
    <div className={className} style={{ ...themeStyle(theme), display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TactileStudioProvider initialDocument={initialDocument} onChange={onChange} onDirtyChange={onDirtyChange}>
        <EditorBody services={services} labels={labels} />
      </TactileStudioProvider>
    </div>
  );
}

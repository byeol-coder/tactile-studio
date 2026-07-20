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
// STILL DEFERRED (docs/known-issues.md #5): full Figma-exact
// spacing/typography and pixel-level visual polish that needs direct Figma
// file access to verify.

import React, { useEffect, useRef, useState } from 'react';
import { TactileStudioProvider } from './TactileStudioProvider.js';
import { useEditorStore } from './hooks/useEditorStore.js';
import { StudioCanvas } from '../ui/canvas/StudioCanvas.js';
import { Toolbar } from '../ui/toolbar/Toolbar.js';
import { PagePanel } from '../ui/panels/PagePanel.js';
import { Inspector } from '../ui/inspector/Inspector.js';
import { DotPadPanel } from '../ui/dotpad/DotPadPanel.js';
import { ImportDialog } from '../ui/dialogs/ImportDialog.js';
import { ExportMenu } from '../ui/dialogs/ExportMenu.js';
import { CorpusSearchPanel } from '../ui/corpus/CorpusSearchPanel.js';
import { LiveRegion } from '../ui/live-region/LiveRegion.js';
import { Toast } from '../ui/toast/Toast.js';
import { RecoveryBanner } from '../ui/recovery/RecoveryBanner.js';
import { EmptyStateHint } from '../ui/hints/EmptyStateHint.js';
import { QualityPanel } from '../ui/quality/QualityPanel.js';
import { createSessionRecoveryStorageAdapter } from '../storage/adapters/session-recovery-storage-adapter.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useHardwareKeyPanning } from './hooks/useHardwareKeyPanning.js';
import type { TactileStudioEditorProps, StudioErrorLike } from './types/public-api.js';

function themeStyle(theme?: Record<string, string | undefined>): React.CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme)) if (v != null) style[k] = v;
  return style as React.CSSProperties;
}

/** Triggers a browser file download for an export result (mirrors the
 *  monolith's downloadBlob). Guarded for environments without
 *  URL.createObjectURL (e.g. some test runners). */
function triggerDownload(result: import('../ui/dialogs/ExportMenu.js').ExportResult) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') return;
  const blob = result.format === 'png' ? result.blob : new Blob([result.json], { type: result.format === 'svg' ? 'image/svg+xml' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface EditorBodyProps extends Pick<TactileStudioEditorProps, 'services' | 'labels'> {
  onSave?: TactileStudioEditorProps['onSave'];
  onSaveConflict?: TactileStudioEditorProps['onSaveConflict'];
  onError?: TactileStudioEditorProps['onError'];
  onExport?: TactileStudioEditorProps['onExport'];
  onExit?: TactileStudioEditorProps['onExit'];
  initialVersion?: string;
}

/** Internal — must render inside TactileStudioProvider to reach the store. */
function EditorBody({ services, labels, onSave, onSaveConflict, onError, onExport, onExit, initialVersion }: EditorBodyProps) {
  useKeyboardShortcuts(labels);
  useHardwareKeyPanning(services.tactileDisplay);
  const { store } = useEditorStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState<string | undefined>(initialVersion);
  const [focusMode, setFocusMode] = useState(false);
  const [showPanels, setShowPanels] = useState(false);
  const focusRoot = useRef<HTMLDivElement>(null);

  const exitFocusMode = () => {
    setFocusMode(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen?.();
  };
  const toggleFocusMode = async () => {
    if (focusMode) return exitFocusMode();
    setFocusMode(true);
    try { await focusRoot.current?.requestFullscreen?.(); } catch { /* browser fullscreen is optional */ }
  };
  useEffect(() => {
    const onFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => { document.removeEventListener('fullscreenchange', onFullscreenChange); };
  }, [focusMode]);

  const reportError = (err: StudioErrorLike) => { onError?.(err); };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const doc = store.getDocument();
      const result = await services.storage.save(doc, { expectedVersion: version });
      if (result.conflict) {
        const message = (labels?.saveConflict as string) || 'A newer version exists. Your local work is still safe.';
        onSaveConflict?.(doc, result);
        reportError({ code: 'save-conflict', message, cause: result });
        store.announce(message);
        store.toastMsg(message);
        return;
      }
      if (!result.ok) throw new Error(result.error || 'Save failed');
      if (result.version != null) setVersion(result.version);
      store.markSaved();
      store.announce((labels?.saved as string) || 'Saved');
      await onSave?.(doc);
    } catch (e: any) {
      reportError({ code: 'save-failed', message: e?.message || 'Save failed', cause: e });
      store.announce((labels?.saveFailed as string) || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S triggers save, separate from useKeyboardShortcuts (undo/redo
  // only) since save needs access to services/labels this hook doesn't have.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.storage, labels]);

  return (
    <div ref={focusRoot} tabIndex={focusMode ? -1 : undefined} onKeyDown={(e) => { if (e.key === 'Escape' && focusMode) { e.preventDefault(); exitFocusMode(); } }} data-focus-mode={focusMode || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(focusMode ? { minHeight: '100vh', padding: 16, background: 'var(--ts-bg, #FFFFFF)' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Toolbar labels={labels} />
        <span style={{ flex: 1 }} />
        {onExit && <button type="button" onClick={onExit}>{(labels?.exit as string) || 'Exit'}</button>}
        <button type="button" onClick={toggleFocusMode} aria-pressed={focusMode} aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>{focusMode ? 'Exit focus' : 'Focus mode'}</button>
        <button type="button" disabled={saving} onClick={handleSave}>{saving ? ((labels?.saving as string) || 'Saving…') : ((labels?.save as string) || 'Save')}</button>
        <button type="button" onClick={() => setImportOpen(true)}>{(labels?.impAssetTitle as string) || 'Import'}</button>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setExportOpen((v) => !v)}>{(labels?.tExport as string) || 'Export'}</button>
          {exportOpen && services.encodeBits && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--ts-bg, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, padding: 8, zIndex: 40 }}>
              <ExportMenu
                encodeBits={services.encodeBits}
                bitsToSvg={services.bitsToSvg}
                labels={labels}
                onExport={(r) => { triggerDownload(r); onExport?.({ format: r.format, filename: r.filename }); setExportOpen(false); }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: '100%', justifyContent: focusMode ? 'center' : undefined }}>
        {focusMode && <button type="button" onClick={() => setShowPanels((v) => !v)} aria-expanded={showPanels} aria-controls="ts-focus-panels">{showPanels ? 'Hide panels' : 'Show panels'}</button>}
        {(!focusMode || showPanels) && <div id="ts-focus-panels" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PagePanel labels={labels} />
          {services.corpus && <CorpusSearchPanel corpus={services.corpus} labels={labels} />}
        </div>}
        <StudioCanvas ariaLabel={(labels?.canvasAria as string) || 'Tactile drawing canvas'} />
        {(!focusMode || showPanels) && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Inspector labels={labels} gridFx={services.gridFx} braille={services.braille} />
          <QualityPanel />
          {services.tactileDisplay && <DotPadPanel adapter={services.tactileDisplay} encodeBits={services.encodeBits} labels={labels} onError={reportError} />}
        </div>}
      </div>

      <LiveRegion />
      <Toast />
      <RecoveryBanner labels={labels} />
      <EmptyStateHint labels={labels} />

      <ImportDialog open={importOpen} labels={labels} onClose={() => setImportOpen(false)} imageProcessing={services.imageProcessing} />
    </div>
  );
}

export function TactileStudioEditor({
  initialDocument, initialVersion, services, labels, theme, onChange, onSave, onSaveConflict, onDirtyChange, onError, onExport, onExit, className,
}: TactileStudioEditorProps) {
  // Studio owns local crash-recovery storage directly (same rationale as the
  // local-library "saved shelf") -- the real localStorage-backed adapter is
  // supplied automatically unless the host overrides it (e.g. tests, or a
  // host that wants to disable/relocate it), same "optional override of the
  // default local codec" pattern as imageProcessing.
  const [sessionRecovery] = useState(() => services.sessionRecovery ?? createSessionRecoveryStorageAdapter());
  return (
    <div className={className} style={{ ...themeStyle(theme), display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TactileStudioProvider initialDocument={initialDocument} onChange={onChange} onDirtyChange={onDirtyChange} sessionRecovery={sessionRecovery}>
        <EditorBody services={services} labels={labels} initialVersion={initialVersion} onSave={onSave} onSaveConflict={onSaveConflict} onError={onError} onExport={onExport} onExit={onExit} />
      </TactileStudioProvider>
    </div>
  );
}

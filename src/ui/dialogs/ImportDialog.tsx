// src/ui/dialogs/ImportDialog.tsx
//
// File picker → parseLibraryAssetPages (Phase 3 codec, pure JSON parsing +
// DTMS decode) → replaces the document's pages. DEFERRED (documented): image
// file import (needs ImageProcessingService wiring + a crop-selection UI),
// auto BANA check display, braille-language detection UI.

import React, { useState } from 'react';
import { parseLibraryAssetPages } from '../../codecs/library-asset-v1/library-asset-v1.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface ImportDialogProps {
  open: boolean;
  labels?: StudioLabels;
  onClose(): void;
}

export function ImportDialog({ open, labels, onClose }: ImportDialogProps) {
  const { store } = useEditorStore();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    let obj: unknown = null;
    try { obj = JSON.parse(await file.text()); } catch { obj = null; }
    if (!obj) {
      setError((labels?.aAssetBadFmt as string) || 'Not a supported tactile asset file (DTMS or library JSON).');
      return;
    }
    const parsed = parseLibraryAssetPages(obj);
    if (!parsed) {
      setError((labels?.aAssetBadFmt as string) || 'Not a supported tactile asset file (DTMS or library JSON).');
      return;
    }
    store.loadPages(parsed.pages.map((p) => p.cells), parsed.title || file.name.replace(/\.[^.]+$/, ''));
    onClose();
  };

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div role="dialog" aria-modal="true" aria-label={(labels?.impAssetTitle as string) || 'Import tactile asset'} style={{ background: 'var(--ts-bg, #FFFFFF)', borderRadius: 12, padding: 20, minWidth: 320 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{(labels?.impAssetTitle as string) || 'Import tactile asset'}</div>
        <p style={{ fontSize: 13, marginBottom: 12 }}>{(labels?.impAssetSub as string) || 'Load a TGIL / DTMS / library file (.json/.dtms).'}</p>
        <input
          type="file"
          accept=".json,.dtms,application/json"
          aria-label={(labels?.impAssetChoose as string) || 'Choose asset file'}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }}
        />
        {error && <div role="alert" style={{ color: 'var(--ts-danger, #DA120D)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

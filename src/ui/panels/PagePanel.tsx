// src/ui/panels/PagePanel.tsx
//
// Page list + add/delete/move controls. DEFERRED (documented): thumbnails
// and drag-and-drop reordering — this pass provides Move up/down buttons
// (keyboard-operable) instead of a drag handle, and a plain numbered list
// instead of rendered thumbnails.

import React from 'react';
import { usePages } from '../../react/hooks/usePages.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface PagePanelProps {
  labels?: StudioLabels;
}

export function PagePanel({ labels }: PagePanelProps) {
  const { pageIndex, pageCount, addPage, deletePageAt, movePage } = usePages();
  const { store } = useEditorStore();
  const pagesLabel = (labels?.pagesLabel as string) || 'Pages';
  const addLabel = (labels?.addPage as string) || 'Add page';

  return (
    <div role="region" aria-label={pagesLabel} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{pagesLabel}</span>
        <button type="button" aria-label={addLabel} title={addLabel} onClick={() => addPage()} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}>＋</button>
      </div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              aria-current={i === pageIndex ? 'true' : undefined}
              onClick={() => store.setActivePage(i)}
              style={{
                flex: 1, textAlign: 'left', padding: '6px 8px', borderRadius: 6, border: 'none',
                background: i === pageIndex ? 'var(--ts-primary, #C43D00)' : 'transparent',
                color: i === pageIndex ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
                cursor: 'pointer',
              }}
            >
              {i + 1}
            </button>
            <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => movePage(i, i - 1)} style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button type="button" aria-label="Move down" title="Move down" disabled={i === pageCount - 1} onClick={() => movePage(i, i + 1)} style={{ opacity: i === pageCount - 1 ? 0.3 : 1 }}>↓</button>
            <button type="button" aria-label="Delete page" title="Delete page" disabled={pageCount <= 1} onClick={() => deletePageAt(i)} style={{ opacity: pageCount <= 1 ? 0.3 : 1 }}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

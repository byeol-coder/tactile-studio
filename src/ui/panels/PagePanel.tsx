// src/ui/panels/PagePanel.tsx
//
// Page list with thumbnails, add/delete/move-up-down buttons (kept for
// keyboard/screen-reader operability), and pointer-based drag-and-drop
// reordering via a grip handle. Native HTML5 drag-and-drop (dragstart/
// dragover/drop) is deliberately NOT used — jsdom has no DragEvent
// implementation (mirrors the earlier PointerEvent gap), and a pointer-based
// implementation is directly testable with the same firePointerEvent-style
// pattern used elsewhere in this codebase.
//
// Deleting a page asks for confirmation via ConfirmDialog (a destructive,
// non-undoable action — page ops don't go through history). Every action
// also calls store.announce() with host-labeled text for the live region.

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { usePages } from '../../react/hooks/usePages.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';
import { PageThumbnail } from './PageThumbnail.js';
import { ConfirmDialog } from '../dialogs/ConfirmDialog.js';

export interface PagePanelProps {
  labels?: StudioLabels;
}

export function PagePanel({ labels }: PagePanelProps) {
  const { pageIndex, pageCount, addPage, duplicatePage, deletePageAt, movePage } = usePages();
  const { snapshot, store } = useEditorStore();
  const pagesLabel = (labels?.pagesLabel as string) || 'Pages';
  const addLabel = (labels?.addPage as string) || 'Add page';
  const doc = store.getDocument();
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);

  const announcePage = (i: number, n: number) => {
    const tpl = (labels?.aPage as string) || 'Page {i} of {n}';
    store.announce(tpl.replace('{i}', String(i)).replace('{n}', String(n)));
  };

  const computeTargetIndex = useCallback((clientY: number): number => {
    let target = 0;
    for (const [i, el] of itemRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY >= mid) target = i + 1;
    }
    return Math.max(0, Math.min(pageCount - 1, target));
  }, [pageCount]);

  const onHandlePointerDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragFromRef.current = i;
    setDragFrom(i);
    setDragOverIndex(i);
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* optimization only */ }
  };

  useEffect(() => {
    if (dragFrom == null) return;
    const onMove = (e: PointerEvent) => setDragOverIndex(computeTargetIndex(e.clientY));
    const onUp = (e: PointerEvent) => {
      const from = dragFromRef.current;
      const to = computeTargetIndex(e.clientY);
      if (from != null && to !== from) {
        movePage(from, to);
        store.announce(((labels?.aPageMoved as string) || 'Page moved to position {n}').replace('{n}', String(to + 1)));
      }
      dragFromRef.current = null;
      setDragFrom(null);
      setDragOverIndex(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [dragFrom, computeTargetIndex, movePage, store, labels]);

  const confirmDelete = () => {
    if (confirmDeleteIndex == null) return;
    const i = confirmDeleteIndex;
    setConfirmDeleteIndex(null);
    deletePageAt(i);
    store.announce((labels?.aPageDeleted as string) || 'Page deleted');
  };

  return (
    <div role="region" aria-label={pagesLabel} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{pagesLabel}</span>
        <button
          type="button"
          aria-label={addLabel}
          title={addLabel}
          onClick={() => { addPage(); announcePage(store.getDocument().pageIndex + 1, store.getDocument().pages.length); }}
          style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          ＋
        </button>
      </div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
          <li
            key={i}
            ref={(el) => { if (el) itemRefs.current.set(i, el); else itemRefs.current.delete(i); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 2,
              outline: dragOverIndex === i && dragFrom != null && dragFrom !== i ? '2px dashed var(--ts-primary, #C43D00)' : 'none',
              opacity: dragFrom === i ? 0.5 : 1,
            }}
          >
            <button
              type="button"
              aria-label={`Reorder page ${i + 1}`}
              title="Drag to reorder"
              onPointerDown={onHandlePointerDown(i)}
              style={{ cursor: 'grab', border: 'none', background: 'transparent', padding: 2 }}
            >
              ⠿
            </button>
            <button
              type="button"
              aria-current={i === pageIndex ? 'true' : undefined}
              onClick={() => { store.setActivePage(i); announcePage(i + 1, pageCount); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', padding: '4px 6px', borderRadius: 6, border: 'none',
                background: i === pageIndex ? 'var(--ts-primary, #C43D00)' : 'transparent',
                color: i === pageIndex ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
                cursor: 'pointer',
              }}
            >
              <PageThumbnail cells={doc.pages[i]} gridW={snapshot.gridW} gridH={snapshot.gridH} />
              <span>{i + 1}</span>
            </button>
            <button
              type="button"
              aria-label={(labels?.pageDuplicate as string) || 'Duplicate page'}
              title={(labels?.pageDuplicate as string) || 'Duplicate page'}
              onClick={() => {
                duplicatePage(i);
                const tpl = (labels?.aPageDup as string) || 'Page {i} duplicated. {n} pages total';
                store.announce(tpl.replace('{i}', String(i + 2)).replace('{n}', String(pageCount + 1)));
              }}
            >⧉</button>
            <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => { movePage(i, i - 1); store.announce(((labels?.aPageMoved as string) || 'Page moved to position {n}').replace('{n}', String(i))); }} style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button type="button" aria-label="Move down" title="Move down" disabled={i === pageCount - 1} onClick={() => { movePage(i, i + 1); store.announce(((labels?.aPageMoved as string) || 'Page moved to position {n}').replace('{n}', String(i + 2))); }} style={{ opacity: i === pageCount - 1 ? 0.3 : 1 }}>↓</button>
            <button type="button" aria-label="Delete page" title="Delete page" disabled={pageCount <= 1} onClick={() => setConfirmDeleteIndex(i)} style={{ opacity: pageCount <= 1 ? 0.3 : 1 }}>✕</button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirmDeleteIndex != null}
        title={(labels?.confirmDeletePageTitle as string) || 'Delete this page?'}
        message={(labels?.confirmDeletePageMsg as string) || 'This cannot be undone.'}
        confirmLabel={(labels?.delete as string) || 'Delete'}
        cancelLabel={(labels?.cancel as string) || 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteIndex(null)}
      />
    </div>
  );
}

// src/ui/help/HelpDialog.tsx
//
// Keyboard-shortcuts help dialog. Lists ONLY what actually works in this
// package right now (tool shortcuts, ported in useKeyboardShortcuts.ts this
// same pass, plus undo/redo which already existed) -- not vanilla's full
// shortcutRegistry(), which also documents zoom (Ctrl+/-/0) and
// accessibility-mode canvas navigation (Space/arrows/Enter) that this port
// doesn't have UI for yet (see useKeyboardShortcuts.ts's own doc comment).
// Listing shortcuts that don't fire here would be actively misleading, not
// just incomplete, so those rows are omitted rather than shown as
// "coming soon" placeholders.
//
// Reuses useFocusTrap (same as ConfirmDialog/ImportDialog) for the modal
// focus-trap behavior rather than reimplementing it, and the Mac/Ctrl
// display-only distinction mirrors the monolith's own _isMac() (index.html)
// -- display only; the actual listener in useKeyboardShortcuts.ts already
// accepts both ctrlKey and metaKey regardless of platform.

import React, { useEffect } from 'react';
import { useFocusTrap } from '../dialogs/useFocusTrap.js';
import type { StudioLabels } from '../../react/types/public-api.js';

function isMac(): boolean {
  try { return /Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + ' ' + (navigator.userAgent || '')); }
  catch { return false; }
}

interface ShortcutRow {
  keys: string;
  nameKey: string;
  fallback: string;
}

// id -> key letter, identical to useKeyboardShortcuts.ts's TOOL_KEYS (kept
// as a separate literal here rather than importing that module's internal
// map, since this is display-only content and the hook doesn't export it).
const TOOL_ROWS: Array<{ letter: string; toolId: string; fallback: string }> = [
  { letter: 'P', toolId: 'pen', fallback: 'Pen' },
  { letter: 'E', toolId: 'eraser', fallback: 'Eraser' },
  { letter: 'L', toolId: 'line', fallback: 'Line' },
  { letter: 'R', toolId: 'rect', fallback: 'Rectangle' },
  { letter: 'O', toolId: 'ellipse', fallback: 'Ellipse' },
  { letter: 'G', toolId: 'poly', fallback: 'Polygon' },
  { letter: 'F', toolId: 'fill', fallback: 'Fill' },
  { letter: 'S', toolId: 'select', fallback: 'Select' },
  { letter: 'T', toolId: 'text', fallback: 'Tactile text' },
  { letter: 'V', toolId: 'cursor', fallback: 'Cursor' },
];

export interface HelpDialogProps {
  open: boolean;
  labels?: StudioLabels;
  onClose(): void;
}

export function HelpDialog({ open, labels, onClose }: HelpDialogProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mod = isMac() ? '\u2318' : 'Ctrl';
  const names = labels?.toolNames as Record<string, string> | undefined;
  const editingRows: ShortcutRow[] = [
    { keys: `${mod}Z`, nameKey: 'undo', fallback: (labels?.undo as string) || 'Undo' },
    { keys: `${mod}\u21e7Z`, nameKey: 'redo', fallback: (labels?.redo as string) || 'Redo' },
  ];

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={(labels?.helpTitle as string) || 'Keyboard shortcuts'}
        style={{ background: 'var(--ts-bg, #FFFFFF)', borderRadius: 12, padding: 20, minWidth: 280, maxWidth: 360, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>{(labels?.helpTitle as string) || 'Keyboard shortcuts'}</div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ts-text-secondary, #6B6862)', marginBottom: 4 }}>
          {(labels?.scgTools as string) || 'Tools'}
        </div>
        <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TOOL_ROWS.map((row) => (
            <li key={row.toolId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{names?.[row.toolId] || row.fallback}</span>
              <kbd style={{ fontFamily: 'inherit', fontSize: 12, background: 'var(--ts-bg-warm, #F7F4EF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 4, padding: '1px 6px' }}>{row.letter}</kbd>
            </li>
          ))}
        </ul>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ts-text-secondary, #6B6862)', marginBottom: 4 }}>
          {(labels?.scgEditing as string) || 'Editing'}
        </div>
        <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {editingRows.map((row) => (
            <li key={row.nameKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{row.fallback}</span>
              <kbd style={{ fontFamily: 'inherit', fontSize: 12, background: 'var(--ts-bg-warm, #F7F4EF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 4, padding: '1px 6px' }}>{row.keys}</kbd>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>{(labels?.close as string) || 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

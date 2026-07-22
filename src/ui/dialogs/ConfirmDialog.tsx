// src/ui/dialogs/ConfirmDialog.tsx
//
// General-purpose confirm/cancel dialog. `onCancel` is optional: when
// omitted, this renders as a single-button acknowledgment ("info" mode) —
// e.g. explaining why an action is unavailable, rather than offering a real
// two-way choice. Existing two-button callers (PagePanel's delete-page
// confirmation) are unaffected since they always pass onCancel.
import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from './useFocusTrap.js';
import { actionBtnStyle } from '../common/action-button-style.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm(): void;
  onCancel?(): void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(open, confirmRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (onCancel ?? onConfirm)(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div ref={containerRef} role="alertdialog" aria-modal="true" aria-label={title} style={{ background: 'var(--ts-surface, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 12, padding: 20, minWidth: 280, color: 'var(--ts-ink, #1E1C1A)', fontFamily: 'inherit' }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{title}</div>
        {message && <div style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{message}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {onCancel && <button type="button" onClick={onCancel} style={actionBtnStyle()}>{cancelLabel}</button>}
          <button type="button" ref={confirmRef} onClick={onConfirm} style={actionBtnStyle({ pressed: true })}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

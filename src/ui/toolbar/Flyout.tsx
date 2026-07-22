// src/ui/toolbar/Flyout.tsx
//
// A small reusable dropdown/flyout: a trigger button + a popover panel that
// opens on click, closes on outside click or Escape, and restores focus to
// the trigger on close (basic focus-trap discipline, matching the
// migration's accessibility requirements). Used by Toolbar for the
// shape-tool group and the thickness group — the monolith's "toolbar-pill"
// pattern (main content in the trigger, options in the popover).

import React, { useEffect, useRef, useState } from 'react';

export interface FlyoutProps {
  trigger: (props: { onClick: () => void; open: boolean; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  ariaLabel: string;
}

export function Flyout({ trigger, children, ariaLabel }: FlyoutProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {trigger({ onClick: () => setOpen((v) => !v), open, ref: triggerRef })}
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 60,
            display: 'flex', gap: 2, padding: 6, borderRadius: 8,
            background: 'var(--ts-surface, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

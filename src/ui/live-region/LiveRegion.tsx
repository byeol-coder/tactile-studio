// src/ui/live-region/LiveRegion.tsx
//
// Verbatim port of the monolith's bottom-panel announce region: a single
// role="status" aria-live="polite" element reflecting store.announce()
// calls. Screen readers announce tool selection, undo/redo, page ops,
// clear/invert/flip, and braille Apply results here — visually
// unobtrusive (small, muted text) but always present in the DOM so
// assistive tech picks up every update.

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';

export function LiveRegion() {
  const { snapshot } = useEditorStore();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ fontSize: 12, color: 'var(--ts-muted, #57534E)', minHeight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {snapshot.announce}
    </div>
  );
}

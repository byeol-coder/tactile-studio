// src/ui/common/action-button-style.ts
//
// Shared style for plain text action buttons (Save/Import/Export/Confirm/
// Cancel/Close and similar) across dialogs and the top-level editor bar.
// Originally written inline in TactileStudioEditor.tsx for its own top-bar
// buttons; extracted here once ConfirmDialog/ImportDialog/ExportMenu/
// HelpDialog needed the exact same treatment rather than each inventing its
// own (see docs/known-issues.md #5 — these were all bare <button> elements
// with no style at all). Matches the same var(--ts-x, #fallback) convention
// already used by IconButton, so it renders sensibly even for a host that
// never defines the --ts-* custom properties.

import type React from 'react';

export function actionBtnStyle(opts: { pressed?: boolean; disabled?: boolean; iconOnly?: boolean } = {}): React.CSSProperties {
  const { pressed, disabled, iconOnly } = opts;
  return {
    height: 36,
    padding: iconOnly ? 0 : '0 14px',
    width: iconOnly ? 36 : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    border: `1px solid ${pressed ? 'var(--ts-primary, #C43D00)' : 'var(--ts-line, #ECE6DC)'}`,
    borderRadius: 8,
    background: pressed ? 'var(--ts-primary, #C43D00)' : 'var(--ts-surface, #FFFFFF)',
    color: pressed ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

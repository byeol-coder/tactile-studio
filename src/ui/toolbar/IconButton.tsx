// src/ui/toolbar/IconButton.tsx
import React from 'react';
import { Icon } from '../icons/Icon.js';
import { Tooltip } from '../tooltip/Tooltip.js';

export interface IconButtonProps {
  icon: string;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick(): void;
  /** Optional keyboard-shortcut hint and longer description shown in the
   *  custom tooltip (verbatim-ported positioning, see ui/tooltip). */
  keyHint?: string;
  desc?: string;
}

export function IconButton({ icon, label, pressed, disabled, onClick, keyHint, desc }: IconButtonProps) {
  return (
    <Tooltip label={label} keyHint={keyHint} desc={desc}>
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          padding: 0,
          borderRadius: 8,
          border: '1px solid var(--ts-line, #ECE6DC)',
          background: pressed ? 'var(--ts-primary, #C43D00)' : 'var(--ts-surface, #FFFFFF)',
          color: pressed ? '#FFFFFF' : 'var(--ts-ink, #1E1C1A)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Icon name={icon} size={18} />
      </button>
    </Tooltip>
  );
}

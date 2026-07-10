// src/ui/toolbar/IconButton.tsx
import React from 'react';
import { Icon } from '../icons/Icon.js';

export interface IconButtonProps {
  icon: string;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick(): void;
}

export function IconButton({ icon, label, pressed, disabled, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
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
  );
}

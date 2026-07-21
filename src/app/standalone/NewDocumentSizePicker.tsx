// src/app/standalone/NewDocumentSizePicker.tsx
//
// Minimal "what size?" choice shown once, only when the standalone app has
// no saved document yet (see StandaloneApp.tsx) — NOT a Hub. Hub/Template
// Gallery/Command panel were explicitly dropped from this build's scope; the
// only reason a size choice exists at all is that without it, an A4
// document could never be created, and the DotPad-incompatibility warning
// (DotPadPanel.tsx) would have nothing to ever warn about. Three options
// only, matching vanilla's OUTPUTS table entries that are actually
// meaningful at creation time (vanilla's fourth option, 28x40 "compact", is
// left out here — not a supported size anywhere else in this migration
// branch's ported UI, so adding it would be new scope, not parity).

import React from 'react';

export interface SizeChoice {
  key: '60x40' | '96x64' | 'a4';
  w: number;
  h: number;
  label: string;
  sub: string;
}

// w/h match vanilla's index.html OUTPUTS table exactly (60x40 / 96x64 /
// a4: 84x118 — see DotPadPanel.tsx's A4_GRID_W/A4_GRID_H constants, same
// numbers, deliberately not re-derived from a shared constant since these
// two files have no existing shared "grid presets" module to put one in).
const CHOICES: SizeChoice[] = [
  { key: '60x40', w: 60, h: 40, label: '60\u00d740 DotPad', sub: 'Standard DotPad' },
  { key: '96x64', w: 96, h: 64, label: '96\u00d764 DotPad', sub: 'Large DotPad' },
  { key: 'a4', w: 84, h: 118, label: 'A4 \uc810\uc790\uc6a9\uc9c0', sub: 'Embossing only \u2014 not sendable to DotPad hardware' },
];

export interface NewDocumentSizePickerProps {
  onChoose(choice: SizeChoice): void;
}

export function NewDocumentSizePicker({ onChoose }: NewDocumentSizePickerProps) {
  return (
    <main
      role="main"
      aria-label="New tactile document"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: 20, padding: 24, fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Choose a canvas size</h1>
      <div role="group" aria-label="Canvas size" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {CHOICES.map((choice) => (
          <button
            key={choice.key}
            type="button"
            onClick={() => onChoose(choice)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start',
              minWidth: 180, padding: '16px 18px', borderRadius: 12,
              border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-bg, #FFFFFF)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700 }}>{choice.label}</span>
            <span style={{ fontSize: 12, color: 'var(--ts-text-secondary, #6B6862)' }}>{choice.sub}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

export { CHOICES as SIZE_CHOICES };

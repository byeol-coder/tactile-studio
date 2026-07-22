// src/app/development-shell/DevApp.tsx
//
// Local-only harness for developing/testing the reusable editor without a
// host app. Uses mock services exclusively — mock storage, mock DotPad
// adapter, a sample document. NONE of this ships as part of the production
// <TactileStudioEditor> bundle; a real host (Tactile World) supplies its own
// services and never imports this file.
//
// The --ts-* custom properties below are a WORKED EXAMPLE of the theme a
// real host is expected to supply (see docs/known-issues.md #5) — every
// component already falls back to these exact values via var(--ts-x,
// #fallback), so defining them here doesn't change anything visually; it's
// here so a developer reading this file sees the intended contract
// explicitly, and so any future component that forgets its own fallback
// still renders correctly in this harness. Values match the shipped vanilla
// monolith's own tokens (--ts-primary, --ts-border-decor, --ts-panel,
// --ts-text-primary, --ts-bg-warm, --ts-danger) so this harness looks like
// the real product, not a developer-only placeholder theme.

import React from 'react';
import { TactileStudioEditor } from '../../react/TactileStudioEditor.js';
import { createDocument } from '../../core/document/document.js';
import { createMemoryStorageAdapter } from '../../storage/adapters/memory-storage-adapter.js';
import { createMockDotPadAdapter } from '../../device/dotpad/mock-adapter.js';

const sampleDocument = createDocument('dev-sample', 60, 40);

const rootStyle = {
  '--ts-primary': '#C43D00',
  '--ts-line': '#ECE6DC',
  '--ts-surface': '#FFFFFF',
  '--ts-ink': '#1E1C1A',
  '--ts-bg': '#F7F4EF',
  '--ts-danger': '#DA120D',
  padding: 16,
  fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
  maxWidth: '100%',
  overflow: 'hidden',
  background: 'var(--ts-bg)',
  color: 'var(--ts-ink)',
  minHeight: '100vh',
  boxSizing: 'border-box',
} as React.CSSProperties;

export function DevApp() {
  const storage = React.useMemo(() => createMemoryStorageAdapter(), []);
  const tactileDisplay = React.useMemo(() => createMockDotPadAdapter(), []);

  return (
    <main style={rootStyle}>
      <h1 style={{ fontSize: 16, marginTop: 0 }}>Tactile Studio — development shell</h1>
      <TactileStudioEditor
        initialDocument={sampleDocument}
        services={{ storage, tactileDisplay }}
        onChange={(doc) => console.log('[dev-shell] onChange', doc.pages.length, 'page(s)')}
        onDirtyChange={(dirty) => console.log('[dev-shell] dirty:', dirty)}
        onError={(err) => console.error('[dev-shell] error:', err)}
      />
    </main>
  );
}

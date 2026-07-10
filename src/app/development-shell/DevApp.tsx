// src/app/development-shell/DevApp.tsx
//
// Local-only harness for developing/testing the reusable editor without a
// host app. Uses mock services exclusively — mock storage, mock DotPad
// adapter, a sample document. NONE of this ships as part of the production
// <TactileStudioEditor> bundle; a real host (Tactile World) supplies its own
// services and never imports this file.

import React from 'react';
import { TactileStudioEditor } from '../../react/TactileStudioEditor.js';
import { createDocument } from '../../core/document/document.js';
import { createMemoryStorageAdapter } from '../../storage/adapters/memory-storage-adapter.js';
import { createMockDotPadAdapter } from '../../device/dotpad/mock-adapter.js';

const sampleDocument = createDocument('dev-sample', 60, 40);

export function DevApp() {
  const storage = React.useMemo(() => createMemoryStorageAdapter(), []);
  const tactileDisplay = React.useMemo(() => createMockDotPadAdapter(), []);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 16 }}>Tactile Studio — development shell</h1>
      <TactileStudioEditor
        initialDocument={sampleDocument}
        services={{ storage, tactileDisplay }}
        onChange={(doc) => console.log('[dev-shell] onChange', doc.pages.length, 'page(s)')}
        onDirtyChange={(dirty) => console.log('[dev-shell] dirty:', dirty)}
        onError={(err) => console.error('[dev-shell] error:', err)}
      />
    </div>
  );
}

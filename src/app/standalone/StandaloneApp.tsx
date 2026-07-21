// src/app/standalone/StandaloneApp.tsx
//
// Real production host for <TactileStudioEditor> — the standalone entry
// point (no Hub/Template Gallery/Command panel; see the entry-point scoping
// notes: those three screens were deliberately dropped from this build's
// scope). Structurally mirrors src/app/development-shell/DevApp.tsx, but
// every service is the real thing instead of a mock/in-memory stand-in:
//
//   - storage         → createStandaloneDocumentStorageAdapter() (real
//                        localStorage, round-trips the full document)
//   - tactileDisplay  → createBrowserDotPadAdapter() (real Web Bluetooth,
//                        the same adapter the vanilla app's DotPad panel
//                        uses under the hood)
//   - encodeBits / bitsToSvg / gridFx → bridged from the vendored
//                        window.TW.* globals (vendor/tw/pins.js), loaded via
//                        <script> tags in standalone/index.html — same
//                        vendor scripts, same load order as the vanilla app.
//
// Deliberately NOT wired yet (documented gap, not an oversight):
//   - imageProcessing → vendor TW.imageToBits takes an HTMLImageElement and
//                        has no crop/removedDots concept, so it doesn't
//                        satisfy ImageProcessingService's shape without a
//                        real bridge. Import-by-image is unavailable in this
//                        build until that bridge is written.
//   - braille, corpus → need liblouis / a real corpus.js data source neither
//                        of which this entry point loads yet.
// Both are additive follow-ups; the editor works fully without them (those
// features are simply absent from the UI), same graceful-degradation
// contract the library already documents for optional services.

import React from 'react';
import { TactileStudioEditor } from '../../react/TactileStudioEditor.js';
import { createDocument } from '../../core/document/document.js';
import { createStandaloneDocumentStorageAdapter } from '../../storage/adapters/standalone-document-storage-adapter.js';
import { createBrowserDotPadAdapter } from '../../device/dotpad/browser-adapter.js';
// Vendor globals (window.TW.encodeBits/bitsToSVG/thickenBits/denoiseBits,
// from vendor/tw/pins.js loaded as a plain <script> tag — see
// standalone/index.html) are declared once, centrally, in
// device/dotpad/sdk-types.ts alongside window.TW.DP — not redeclared here.

export function StandaloneApp() {
  const storage = React.useMemo(() => createStandaloneDocumentStorageAdapter(), []);
  const tactileDisplay = React.useMemo(() => createBrowserDotPadAdapter(), []);
  const [initialDocument] = React.useState(() => createDocument('', 60, 40));

  // Vendor bridge — only defined if vendor/tw/pins.js actually loaded (it's a
  // plain <script>, not a module import, so this can't be a static import).
  const encodeBits = typeof window !== 'undefined' ? window.TW?.encodeBits : undefined;
  const bitsToSvg = typeof window !== 'undefined' ? window.TW?.bitsToSVG : undefined;
  const gridFx = React.useMemo(() => {
    const thicken = typeof window !== 'undefined' ? window.TW?.thickenBits : undefined;
    const denoise = typeof window !== 'undefined' ? window.TW?.denoiseBits : undefined;
    if (!thicken || !denoise) return undefined;
    return { thicken, denoise };
  }, []);

  return (
    <TactileStudioEditor
      initialDocument={initialDocument}
      services={{ storage, tactileDisplay, encodeBits, bitsToSvg, gridFx }}
      onError={(err) => console.error('[standalone] error:', err)}
    />
  );
}

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
//   - braille, corpus → need liblouis / a real corpus.js data source neither
//                        of which this entry point loads yet.
// This is additive follow-up work; the editor works fully without it (those
// features are simply absent from the UI), same graceful-degradation
// contract the library already documents for optional services.
//
// imageProcessing is deliberately left UNSET here too, but for a different
// reason than the two gaps above: leaving it unset is not a gap at all.
// ImportDialog's `imageProcessing` prop is an OPTIONAL host override — when
// absent, ImportDialog already falls back to codecs/image/image.ts's own
// imgToCells, a pure, parity-tested TypeScript port of the conversion
// algorithm, fed by a real browser canvas decode step
// (browser-image-decoder.ts). That path needs no vendor bridge and image
// import already works end-to-end in this build today (see
// tests/parity/react-editor.test.tsx's "converts via the real imgToCells
// codec" test, which exercises exactly this default path). Wiring vendor's
// TW.imageToBits here would only replace one already-correct algorithm with
// another (and would need a real bridge, since TW.imageToBits takes an
// HTMLImageElement with no crop/removedDots concept, unlike
// ImageProcessingService's shape) — worth doing only if pixel-parity with
// the vendor's own Otsu/Sobel output specifically is ever required, not to
// unblock the feature itself. (An earlier version of this comment claimed
// image import was unavailable without that bridge; it wasn't accurate —
// corrected here.)
//
// First-run size choice: a saved document (localStorage) always wins and
// loads straight into the editor, no picker shown. Only when NOTHING is
// saved yet does NewDocumentSizePicker appear once, so a document can be
// created at a size other than the 60x40 default — otherwise an A4 document
// could never exist and DotPadPanel's A4-incompatibility warning would have
// nothing to ever warn about. See NewDocumentSizePicker.tsx's own doc
// comment for why this is a minimal picker, not a Hub.

import React from 'react';
import { TactileStudioEditor } from '../../react/TactileStudioEditor.js';
import { createDocument } from '../../core/document/document.js';
import {
  createStandaloneDocumentStorageAdapter, hasSavedStandaloneDocument,
} from '../../storage/adapters/standalone-document-storage-adapter.js';
import { createBrowserDotPadAdapter } from '../../device/dotpad/browser-adapter.js';
import { NewDocumentSizePicker, type SizeChoice } from './NewDocumentSizePicker.js';
import type { StudioDocument } from '../../core/types.js';
// Vendor globals (window.TW.encodeBits/bitsToSVG/thickenBits/denoiseBits,
// from vendor/tw/pins.js loaded as a plain <script> tag — see
// standalone/index.html) are declared once, centrally, in
// device/dotpad/sdk-types.ts alongside window.TW.DP — not redeclared here.

export function StandaloneApp() {
  const storage = React.useMemo(() => createStandaloneDocumentStorageAdapter(), []);
  const tactileDisplay = React.useMemo(() => createBrowserDotPadAdapter(), []);

  // null = still deciding; undefined-ish "no document yet" is represented by
  // showing the picker instead (see render below), not by a null document.
  const [initialDocument, setInitialDocument] = React.useState<StudioDocument | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasSavedStandaloneDocument()) {
        const doc = await storage.load('standalone');
        if (!cancelled) { setInitialDocument(doc); setLoading(false); }
      } else {
        // No saved document — leave initialDocument null so the size picker
        // renders; loading is done either way.
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSize = React.useCallback((choice: SizeChoice) => {
    setInitialDocument(createDocument('', choice.w, choice.h));
  }, []);

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

  if (loading) return null;
  if (!initialDocument) return <NewDocumentSizePicker onChoose={chooseSize} />;

  return (
    <TactileStudioEditor
      initialDocument={initialDocument}
      services={{ storage, tactileDisplay, encodeBits, bitsToSvg, gridFx }}
      onError={(err) => console.error('[standalone] error:', err)}
    />
  );
}

# Integrating `<TactileStudioEditor>` into a host app (Tactile World)

This guide is for developers embedding the reusable editor into a host application. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the package is organized internally, and [`docs/known-issues.md`](./docs/known-issues.md) for exactly which features are and aren't implemented yet.

## Quick example

```tsx
import { TactileStudioEditor } from 'tactile-studio/react';
import { createMemoryStorageAdapter } from 'tactile-studio/storage';
import { createDocument } from 'tactile-studio/core';

function StudioPage() {
  const storage = useMemo(() => myHostStorageAdapter, []);

  return (
    <TactileStudioEditor
      initialDocument={createDocument('untitled', 60, 40)}
      services={{ storage }}
      onChange={(doc) => console.log('document changed', doc)}
      onDirtyChange={(dirty) => setUnsavedIndicator(dirty)}
    />
  );
}
```

`<TactileStudioEditor>` renders correctly as a plain child of your own router's route component — it owns no routing, no authentication, and no internal language switching (verified in `tests/parity/product-ownership.test.tsx`). Mount it inside whatever page/route/layout your host app already uses.

> **Packaging note:** `npm run build:package` produces a real, working ESM build (`dist/lib/<entry>/index.js` + `dist/types/<entry>/index.d.ts` for each of `core`/`codecs`/`device`/`storage`/`react`), wired up via `package.json`'s `exports` map — the import paths above are real, not illustrative. This has been smoke-tested by building a standalone consumer app against the built output. The package is `private: true` and **not published to a registry yet** — consume it today as a workspace package, git dependency, or by copying `dist/` after running the build script; publishing to a registry is a small, separate step once a package name/registry is decided.

## Building the package

```sh
npm run build           # build the dev shell, then the reusable package
npm run build:package   # package only: runs build:lib then build:types
# or individually:
npm run build:lib       # vite build --config vite.lib.config.ts → dist/lib/
npm run build:types     # tsc -p tsconfig.build.json → dist/types/
```

This produces five independent ESM entry points — a host importing only `tactile-studio/core` never pulls in React, `tactile-studio/storage`, or anything React-specific:

| Subpath | Contents |
|---|---|
| `tactile-studio/core` | `StudioDocument`/`EditorStore`/grid/geometry/history — no React, no browser API |
| `tactile-studio/codecs` | DTMS, Library Asset v1, vector, image, tactile-text, grid-fx, quality, corpus search, SVG — pure or injection-based, no React |
| `tactile-studio/device` | `TactileDisplayAdapter` + browser/mock DotPad adapters |
| `tactile-studio/storage` | `StudioStorageAdapter` + memory/local-library adapters |
| `tactile-studio/react` | `TactileStudioEditor` and everything under `src/ui/` (re-exported transitively) |

`react`/`react-dom` are `peerDependencies` (marked optional, since only the `react` entry needs them) — the build externalizes them, so your host's own React instance is what actually runs, never a bundled copy. `codecs/braille/liblouis-node` (Node-only — reads real files via `node:fs`) is likewise external to Node built-ins; import it only from Node-side code (build tooling, tests, SSR prep), not from browser bundles.

## Props (`TactileStudioEditorProps`)

| Prop | Type | Required | Notes |
|---|---|---|---|
| `initialDocument` | `StudioDocument` | Yes | Build one with `createDocument(title, w, h)` from `core/document`, or load one via your `StudioStorageAdapter`. |
| `services` | `StudioServices` | Yes | See [Services](#services) below. Only `storage` is required. |
| `labels` | `StudioLabels` | No | Host-supplied UI strings. Everything not provided falls back to an English default. |
| `theme` | `StudioTheme` | No | A map of CSS custom-property names to values, applied as inline styles on the editor's root element (e.g. `{ '--ts-primary': '#FF4F00' }`). |
| `onChange` | `(document: StudioDocument) => void` | No | Called after every document mutation (drawing, page ops, import, cleanup fx, etc.). |
| `onDirtyChange` | `(dirty: boolean) => void` | No | Called when the dirty flag flips. Use this to drive an "unsaved changes" indicator. |
| `onSave` | `(document: StudioDocument) => Promise<void> \| void` | No | Called after a successful save via the Save button or Ctrl/Cmd+S, once `services.storage.save()` resolves `{ ok: true }` and the dirty flag is cleared. |
| `onError` | `(error: StudioErrorLike) => void` | No | Called on a failed save, and on DotPad connect/send failures (in addition to `DotPadPanel`'s own inline error text). Not yet called for every possible failure path — see [Known gaps](#known-gaps-in-this-integration-surface). |
| `onExport` | `(result: { format, filename }) => void` | No | Called after an export completes and the browser download has been triggered. Informational only — can't alter or cancel the export. |
| `className` | `string` | No | Applied to the editor's root `<div>`. |

## Services (`StudioServices`)

Only `storage` is required. Everything else is optional — the editor renders and works for drawing/undo/redo/pages with `storage` alone; each other service unlocks one additional feature area.

```ts
interface StudioServices {
  storage: StudioStorageAdapter;          // required
  tactileDisplay?: TactileDisplayAdapter; // enables the DotPad panel (connect/send)
  braille?: BrailleService;               // enables Inspector's braille language selector + Apply buttons + preview
  imageProcessing?: ImageProcessingService; // optional override for ImportDialog's image conversion (defaults to the local pure codec)
  gridFx?: GridFxService;                 // enables Inspector's Thinner/Thicker/Remove-noise buttons
  encodeBits?: EncodeBitsFn;               // enables DotPad "send" and DTMS/Library-Asset-v1/SVG export
  bitsToSvg?: TwBitsToSvg;                 // enables ExportMenu's SVG button (PNG needs neither — real canvas.toBlob)
  corpus?: CorpusRecord[];                 // enables the corpus/command-panel search UI
}
```

### `storage: StudioStorageAdapter` (required)

```ts
interface StudioStorageAdapter {
  load(id: string): Promise<StudioDocument>;
  save(document: StudioDocument): Promise<{ ok: boolean; id?: string; error?: string }>;
}
```

`storage/adapters/memory-storage-adapter.ts` ships a real, fully-functional in-memory implementation — good for prototyping or tests, not for production (nothing persists across a reload). For production, implement this against your own backend. Tactile Studio never imports Supabase or any specific database client — that's entirely your implementation's business.

### `tactileDisplay?: TactileDisplayAdapter`

```ts
interface TactileDisplayAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  display(buffer: PinBuffer): Promise<void>;   // PinBuffer = hex string, TW.encodeBits' output shape
  clear(): Promise<void>;
  raiseAll?(): Promise<void>;
  lowerAll?(): Promise<void>;
  invert?(): Promise<void>;
  subscribeKeys?(listener: DeviceKeyListener): Unsubscribe;
  getConnectionState(): ConnectionState;
  getDeviceInfo(): DeviceInfo | null;
  dispose(): void;
}
```

Two real implementations ship in `device/dotpad/`:
- `createBrowserDotPadAdapter()` — wraps the actual vendored SDK (`window.TW.DP` / `window.DotPadSDK`) for real hardware over Web Bluetooth.
- `createMockDotPadAdapter(opts?)` — a fully functional in-memory stand-in, useful for development or testing without a physical DotPad.

If you don't provide `tactileDisplay`, the DotPad panel simply doesn't render — the rest of the editor is unaffected.

### `gridFx?: GridFxService` and `encodeBits?: EncodeBitsFn`

Both wrap vendored algorithms (`TW.thickenBits`/`TW.denoiseBits`/`TW.encodeBits` from `vendor/tw/pins.js` in the vanilla app) that Tactile Studio deliberately never reimplements or imports directly — you inject the real functions from wherever your host app already loads that vendor file:

```ts
services={{
  storage,
  encodeBits: (bits, cols, rows) => window.TW.encodeBits(bits, cols, rows),
  gridFx: {
    thicken: (cells, w, h, level) => /* wrap TW.thickenBits via codecs/grid-fx's thickenGrid */,
    denoise: (cells, w, h) => /* wrap TW.denoiseBits via codecs/grid-fx's denoiseGrid */,
  },
}}
```

See `codecs/grid-fx/grid-fx.ts` and `codecs/dtms/dtms.ts` for the exact orchestration helpers (`thickenGrid`, `denoiseGrid`, `encodeDtmsHex`) — they do the `cellsToBits`/`bitsToCells` bridging for you; you only need to supply the raw vendor function.

### `braille?: BrailleService`

```ts
interface BrailleService {
  translate(text: string, langKey: string): Promise<{ ok: boolean; unicode: string; cells: number; reason?: string }>;
}
```

Enables Inspector's braille language selector (Korean Grade 1/2, UEB Grade 1/2) and "Apply braille" buttons on the description and narration fields. `EditorStore.applyBraille` ports the vanilla app's `applyField` semantics: the braille source text is always description-first-then-narration (regardless of which field you clicked Apply on — that's the shipped behavior, not a bug), only one Apply runs at a time, and a page switch mid-flight discards a stale response rather than applying it to the wrong page. **Never falls back to sending raw text if translation fails** — the vendor liblouis README's absolute rule, preserved here too.

A real Node-side implementation exists at `codecs/braille/liblouis-node.ts` (loads the actual vendored liblouis engine + tables) if you need braille translation in Node/SSR context; for the browser, wrap the vanilla app's `window.TSBraille` (or your own) to match the interface above.

### `imageProcessing?: ImageProcessingService`

Optional override for `ImportDialog`'s image-file conversion algorithm. By default (no `imageProcessing` supplied), the dialog uses the local, pure, already-parity-tested `codecs/image` `imgToCells` directly — most hosts never need to provide this at all. Supply it only if you want to swap in a different conversion pipeline; the interface (including its `crop` parameter) matches `imgToCells`'s real capability exactly, so an override is a drop-in replacement, not a reduced-functionality path.

```ts
services={{ storage,
  imageProcessing: { convert: (data, sw, sh, tw, th, opts, crop) => myOwnConverter(data, sw, sh, tw, th, opts, crop) },
}}
```

Image FILE decoding itself (turning a `.png`/`.jpg` into raw pixels) is a separate, real browser step (`ImportDialog`'s internal `decodeImageFile` prop, defaulting to a real `File → <img> → canvas → RGBA` implementation) — not something `services` exposes, since it's not the tactile-conversion algorithm.

### `corpus?: CorpusRecord[]`

Enables the corpus/command-panel search UI (`CorpusSearchPanel`), backed by a verbatim port of the vanilla app's real search engine (`codecs/corpus/corpus-search.ts` — deterministic title/tag/category scoring plus a fuzzy "did you mean" fallback, not a stub). Supply your own corpus data, typically by loading the same `corpus.js` the vanilla app uses and reading `window.DTMS_CORPUS`:

```ts
services={{ storage, corpus: window.DTMS_CORPUS }}
```

No corpus data is bundled with or duplicated inside this package.

## Library Asset v1 round-trip boundary

The Library Asset v1 codec preserves structured description/narration metadata on pages, matching the legacy Studio's `_textOf`/`_metaOf` behavior. Arbitrary unknown top-level Library Asset v1 fields are not guaranteed to survive an import/export round trip. That is the current legacy behavior, not a React migration regression; hosts that need additional top-level metadata should keep it in their own storage boundary.

## `theme: StudioTheme`

A flat map of CSS custom-property names to string values, applied as inline styles on the editor's root `<div>`. Unset tokens fall back to Tactile Studio's own built-in values (`--ts-primary: #C43D00` etc., matching the vanilla app's current design). Example, mapping the vanilla app's actual token names to your host's brand colors:

```tsx
theme={{
  '--ts-primary': '#FF4F00',
  '--ts-primary-hover': '#E04500',
  '--ts-bg': '#FBF8F2',
  '--ts-ink': '#1F1D1A',
  '--ts-line': '#ECE6DC',
}}
```

Only a subset of tokens are actually read by the components built so far (`--ts-primary`, `--ts-line`, `--ts-surface`, `--ts-ink`, `--ts-bg`, `--ts-danger`) — see each component's inline styles for the exact set in use today. The full token list from the original design system is not yet wired everywhere.

## `labels: StudioLabels`

```ts
interface StudioLabels {
  toolNames?: Partial<Record<string, string>>; // { pen: '펜', eraser: '지우개', ... }
  toolDesc?: Partial<Record<string, string>>;
  addPage?: string;
  pagesLabel?: string;
  undo?: string;
  redo?: string;
  [key: string]: unknown; // component-specific labels (inspDesc, inspNarr, tExport, impAssetTitle, ...) — see each component's props
}
```

Tactile Studio never detects the browser's language or ships its own language toggle — you own that decision entirely and pass the appropriate `labels` object down. Anything you don't provide falls back to an English default; there is no error if a key is missing.

## Known gaps in this integration surface

Being upfront about what this prop surface *looks* like it does versus what it *actually* does today:

- `onError` is called for save failures and DotPad connect/send failures, but not for every possible failure path (e.g. braille Apply failures surface only via `Inspector`'s inline preview text, not through `onError`).
- `TactileStudioEditorProps.onExport` fires after the built-in browser-download convenience runs — it's informational only, not a hook to intercept or replace that download.
- Native HTML5 drag-and-drop is not used anywhere (jsdom doesn't implement `DragEvent`, mirroring the `PointerEvent` gap) — page reordering is pointer-based via a grip handle instead.

See `docs/known-issues.md #5` for the complete, currently-accurate list of deferred UI work.

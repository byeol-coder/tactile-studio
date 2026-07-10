# Integrating `<TactileStudioEditor>` into a host app (Tactile World)

This guide is for developers embedding the reusable editor into a host application. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the package is organized internally, and [`docs/known-issues.md`](./docs/known-issues.md) for exactly which features are and aren't implemented yet.

## Quick example

```tsx
import { TactileStudioEditor } from '<package>/react';
import { createMemoryStorageAdapter } from '<package>/storage';
import { createDocument } from '<package>/core';

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

> **Packaging note:** this repository does not yet publish a built package (no `npm publish`-ready `dist/`, no library-mode Vite config). The import paths above (`<package>/react`, `<package>/storage`, `<package>/core`) are illustrative of the intended public surface (`src/react/index.ts`, `src/storage/index.ts`, `src/core/index.ts`) — until a packaging step exists, consume this repository as source (e.g. a workspace package or git submodule) rather than an npm dependency.

## Props (`TactileStudioEditorProps`)

| Prop | Type | Required | Notes |
|---|---|---|---|
| `initialDocument` | `StudioDocument` | Yes | Build one with `createDocument(title, w, h)` from `core/document`, or load one via your `StudioStorageAdapter`. |
| `services` | `StudioServices` | Yes | See [Services](#services) below. Only `storage` is required. |
| `labels` | `StudioLabels` | No | Host-supplied UI strings. Everything not provided falls back to an English default. |
| `theme` | `StudioTheme` | No | A map of CSS custom-property names to values, applied as inline styles on the editor's root element (e.g. `{ '--ts-primary': '#FF4F00' }`). |
| `onChange` | `(document: StudioDocument) => void` | No | Called after every document mutation (drawing, page ops, import, cleanup fx, etc.). |
| `onDirtyChange` | `(dirty: boolean) => void` | No | Called when the dirty flag flips. Use this to drive an "unsaved changes" indicator. |
| `onSave` | `(document: StudioDocument) => Promise<void> \| void` | No | **Accepted but not yet called by anything in this codebase** — there is no save button or keyboard shortcut wired to it in this pass. See [Known gaps](#known-gaps-in-this-integration-surface). |
| `onError` | `(error: StudioErrorLike) => void` | No | **Accepted but not yet called by anything in this codebase.** Device-adapter errors currently surface only inside `DotPadPanel`'s own inline error text, not through this callback. |
| `className` | `string` | No | Applied to the editor's root `<div>`. |

## Services (`StudioServices`)

Only `storage` is required. Everything else is optional — the editor renders and works for drawing/undo/redo/pages with `storage` alone; each other service unlocks one additional feature area.

```ts
interface StudioServices {
  storage: StudioStorageAdapter;          // required
  tactileDisplay?: TactileDisplayAdapter; // enables the DotPad panel (connect/send)
  braille?: BrailleService;               // not yet consumed anywhere (see Known gaps)
  imageProcessing?: ImageProcessingService; // not yet consumed anywhere (see Known gaps)
  gridFx?: GridFxService;                 // enables Inspector's Thinner/Thicker/Remove-noise buttons
  encodeBits?: EncodeBitsFn;               // enables DotPad "send" and DTMS/Library-Asset-v1 export
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

### `braille?: BrailleService` and `imageProcessing?: ImageProcessingService`

These interfaces exist and are typed, but **nothing in the current UI calls them yet** — page-description/narration fields in the Inspector are plain autosave text with no braille "Apply"/preview step, and there is no image-import UI wired to `imageProcessing`. Providing them today has no visible effect. They're placeholders for the next round of feature work (see `docs/known-issues.md #5`).

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

- `onSave` and `onError` are typed and accepted, but nothing in the shipped components calls them. There's no save button, no keyboard-shortcut-triggered save, and device-adapter errors surface only as inline text inside `DotPadPanel`, not through `onError`.
- `braille` and `imageProcessing` services are typed but unconsumed (see above).
- Deleting a page (`PagePanel`'s ✕ button) happens immediately, with no confirmation — `ConfirmDialog` exists as a component but isn't wired to this action yet.
- Export (`ExportMenu`) produces DTMS and Library Asset v1 JSON and triggers a browser file download; there's no PNG or SVG export yet, and no `onExport` callback on `TactileStudioEditorProps` — the download is a self-contained browser convenience, not something the host is notified about.

See `docs/known-issues.md #5` for the complete, currently-accurate list of deferred UI work.

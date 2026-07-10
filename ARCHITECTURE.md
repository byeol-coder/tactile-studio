# Tactile Studio — Architecture

This document describes the **new** React + TypeScript layer being built alongside the canonical vanilla application (`index.html` / `support.js` / `vendor/`), as part of an incremental migration toward a reusable `<TactileStudioEditor>` React component for embedding inside Tactile World.

If you're integrating the editor into a host app, see [`INTEGRATION.md`](./INTEGRATION.md). For the phase-by-phase migration history and compatibility guarantees, see [`MIGRATION.md`](./MIGRATION.md). For known issues and scope notes, see [`docs/known-issues.md`](./docs/known-issues.md).

## Two applications in one repository, on purpose

| | Canonical vanilla app | New React layer |
|---|---|---|
| Entry point | `index.html` (single file, ~5,700 lines of x-dc/React-via-CDN) | `src/react/TactileStudioEditor.tsx` |
| Runtime | Buildless — `text/x-dc` script block compiled by `support.js`'s tiny runtime, React/ReactDOM loaded from `vendor/*.production.min.js` | React 18.3.1, built with Vite 5.4 |
| Deployment | GitHub Pages (`byeol-coder.github.io/tactile-studio/`), also Vercel | Not yet packaged for distribution (see [Status](#status)) |
| Status | **Ships today.** Untouched by this migration — every commit so far has left it byte-for-byte identical (enforced by a fingerprint regression test). | **In progress.** Real, tested, but does not yet have full feature parity — see [`docs/known-issues.md`](./docs/known-issues.md) for exactly what's implemented vs. deferred. |

The vanilla app is the **source of truth for behavior**. Every module under `src/` is either a verbatim port (same algorithm, same edge cases, proven with parity tests against the live vanilla code) or a new, clearly-labeled addition (e.g. the `EditorStore`'s stroke-transaction API, which intentionally batches React notifications differently than the vanilla app's per-pointermove `setState` — see [`ARCHITECTURE.md#editorstore`](#editorstore-and-the-stroke-transaction-api)).

## Folder map

```
src/
  core/                    Pure TypeScript, NO React/DOM/browser API dependency
    types.ts                 StudioDocument, StudioPage, CellGrid, PageMap, HistoryEntry
    document/document.ts      addPage, deletePageAt, movePage, setGrid, goToPage
    grid/grid.ts               resampleGrid, flipHoriz, flipVert, invertAll, clearAll
    geometry/raster.ts         line (Bresenham), rectOutline, ellipseOutline, makeBrush, floodFill
    history/history.ts         HistoryStack (60-entry undo/redo cap, snapshot/undo/redo)
    page/page-maps.ts          reindexMapInsert/Delete/Move (page-metadata reindexing)
    state/
      types.ts                 ToolId, ToolState, SelectionRect, EditorSnapshot
      editor-store.ts          EditorStore — see below

  codecs/                  Pure orchestration; wraps external libraries by injection, never reimplements them
    dtms/dtms.ts               decodeDtms60x40Hex (verbatim), encodeDtmsHex (injects vendor TW.encodeBits)
    library-asset-v1/          buildLibraryAssetV1, parseLibraryAssetPages, textOf/metaOf
    vector/vectorize.ts        Raster→vector pipeline (connected components, contour trace, RDP, shape classify) — fully pure, no injection needed
    image/image.ts             imgToCells and its _cv* numerics — fully pure, no injection needed
    tactile-text/               stampTextLayout — pure layout; glyph rasterization is an injected GlyphRasterizer
    braille/liblouis-node.ts    Node-native adapter for the REAL vendored liblouis asm.js engine + tables
    grid-fx/grid-fx.ts          thickenGrid/denoiseGrid (injects vendor TW.thickenBits/denoiseBits)
    quality/quality.ts         convQuality, banaPrintCheck — fully pure, no injection needed
    document/local-library.ts  toSavedRecords/fromSavedRecords for the local "saved shelf" format

  device/dotpad/           Device abstraction — UI/core never call window.DotPadSDK directly
    types.ts                  TactileDisplayAdapter, DeviceKeyListener, ConnectionState, StudioDeviceError
    browser-adapter.ts         Wraps the REAL window.TW.DP singleton (vendor/tw/dotpad.js)
    mock-adapter.ts             Fully functional in-memory adapter for dev/tests — no hardware needed
    sdk-types.ts                Ambient types for the vendored SDK, derived by reading its source directly

  storage/adapters/        Storage abstraction — Studio never imports Supabase or owns cloud storage
    types.ts                   StudioStorageAdapter (load/save by id), StudioHostCallbacks
    memory-storage-adapter.ts  In-memory adapter for tests/dev shell
    local-library-storage-adapter.ts  Real localStorage I/O for the local saved-shelf, built on codecs/document

  react/                   The public component surface
    TactileStudioEditor.tsx    Public entry point (see INTEGRATION.md)
    TactileStudioProvider.tsx  Owns one EditorStore per mount, via React Context
    hooks/                     useEditorStore, useTool, useHistory, usePages, useKeyboardShortcuts
    types/public-api.ts        TactileStudioEditorProps, StudioServices, StudioLabels, StudioTheme

  ui/                       Presentational components, all read/write the store via react/hooks
    canvas/StudioCanvas.tsx    Verbatim-ported pixel math (drawMain/evCell) + pointer→store wiring
    canvas/browser-glyph-rasterizer.ts  Real canvas-based text-tool glyph rendering
    toolbar/                    Toolbar, IconButton
    icons/                      Verbatim-ported ICONS SVG path data + <Icon>
    panels/PagePanel.tsx        Page list, add/delete/move, switch active page
    inspector/Inspector.tsx     Page metadata (desc/narration), cleanup (thicken/denoise)
    dotpad/DotPadPanel.tsx      Connect/disconnect/status/send, wired to a TactileDisplayAdapter
    dialogs/                    ImportDialog, ExportMenu, ConfirmDialog

  app/development-shell/    Local-only dev harness (mock services, sample doc) — NOT shipped to hosts
    DevApp.tsx

dev/                       Vite dev-server entry for app/development-shell (see below) — isolated from
                           the repo-root vanilla index.html
  index.html
  main.tsx

tools/                     Node-based test harnesses and baseline-capture scripts (see MIGRATION.md)
tests/
  regression/              Exact-value tests against frozen baseline/ fixtures (Phase 1)
  parity/                  Tests comparing extracted code against the LIVE shipped vanilla implementation
  fixtures/baseline/       Frozen JSON fixtures captured from the shipped app — the compatibility contract
```

## Dependency direction

```
react/ (TactileStudioEditor, Provider, hooks)
  │
  ├─▶ ui/ (Toolbar, StudioCanvas, PagePanel, Inspector, DotPadPanel, dialogs, icons)
  │      │
  │      └─▶ core/state (EditorStore) ─▶ core/{document,grid,geometry,history,page}
  │                                    ─▶ codecs/{dtms,vector,image,tactile-text,grid-fx,...}
  │
  ├─▶ device/dotpad (TactileDisplayAdapter — injected via props.services.tactileDisplay)
  └─▶ storage/adapters (StudioStorageAdapter — injected via props.services.storage)
```

Rules enforced by construction (and audited in `tests/parity/product-ownership.test.tsx`):

- `core/` and `codecs/` never import React, `react-router-dom`, Supabase, or any browser-only global (`window`, `document`) except where a codec's whole purpose is bridging to one (e.g. `device/dotpad/browser-adapter.ts` reads `window.TW.DP` — that's the point of that specific file).
- `codecs/` never reimplements a vendored library's algorithm; every wrapped dependency (`TW.encodeBits`, `TW.thickenBits`, `TW.denoiseBits`, the liblouis engine) is injected by the caller, never imported directly by the codec module.
- `device/` and `storage/` are the *only* places allowed to reach for `window.DotPadSDK`/`window.TW.DP`/`window.localStorage` — everything above them talks to the `TactileDisplayAdapter`/`StudioStorageAdapter` interfaces only.
- `react/` and `ui/` own no routing, authentication, or internal language switching — labels/theme/services are host-supplied props, full stop.

## `EditorStore` and the stroke-transaction API

`src/core/state/editor-store.ts` is deliberately framework-agnostic (no React import) so it can be unit-tested without a DOM and is compatible with React's `useSyncExternalStore` via its `subscribe`/`getSnapshot` methods.

One design decision is **not** a verbatim port and is called out explicitly in code comments: the vanilla app calls `this.bump()` — a real `setState` — on every single `pointermove` while drawing. The migration's own performance requirements ask for the opposite ("keep high-frequency drawing state out of broad React contexts... do not cause the whole editor to rerender for every pin update"), so `EditorStore` exposes a **stroke transaction**:

```ts
store.beginStroke();          // snapshot() once, at gesture start — the undo boundary
store.paintDuring(mutator);   // mutate the active page's cells in place, NO notify — call many times
store.endStroke();            // bump + notify ONCE, at gesture end
```

`StudioCanvas` redraws itself on every `pointermove` via its own `requestAnimationFrame` loop, using a local `ref` for in-progress drag/preview state — completely independent of the store's subscribers. The **final pixels and the resulting undo entry are identical** to what the vanilla app's `snapshot()` + direct mutation + `bump()` sequence produces; only the timing and volume of React notifications differ.

## Adapters: why everything device/storage-related is injected

Per the target architecture, `TactileStudioEditor` must work identically whether it's:
- talking to a real DotPad over Web Bluetooth (`device/dotpad/browser-adapter.ts`, wrapping the real `window.TW.DP` singleton — no reimplementation of connection/GATT/framing logic), or
- running in a test or the development shell with no hardware at all (`device/dotpad/mock-adapter.ts`, a fully functional in-memory stand-in).

The same pattern applies to storage (`StudioStorageAdapter` — host-implemented, no Supabase import anywhere in this package) and to the vendored DTMS/grid-fx algorithms (`encodeBits`/`thickenBits`/`denoiseBits` are always parameters, never imports, inside `codecs/`).

## Status

As of the last commit in this migration:

- **9 commits**, **123 passing tests** (`npm test`), full TypeScript strict-mode typecheck (`npm run typecheck`), and a working Vite 5.4 production build of the development shell (`npm run build:dev-shell`) — see [`MIGRATION.md`](./MIGRATION.md) for the phase-by-phase breakdown.
- The vanilla app (`index.html`) is **untouched** since before this migration started, except for one isolated bugfix (a missing `banaPrintCheck` method — see `docs/known-issues.md #1`).
- The React editor is **functional but not feature-complete** relative to the vanilla app. See `docs/known-issues.md #5` for the explicit list of what's deferred (corpus/command-panel search, full Figma-exact styling, PNG/SVG export, braille "Apply" preview, page thumbnails/drag-reorder, and a few others).
- `<TactileStudioEditor>` is not yet packaged for distribution as a library (no `vite build --mode lib` config, no published package) — that's expected follow-on work once Tactile World's actual integration requirements (bundler, module format) are known.

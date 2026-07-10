# Known Issues (pre-migration baseline)

문서 목적: 마이그레이션 규칙에 따라, **기존 동작에 포함된 확인된 버그**는 수정 전에 별도로 기록한다.
아래 항목은 Phase 1 시점의 `main`에서 실제로 재현·확인된 것이며, 회귀 픽스처는 (버그를 포함한) 현재 동작을 그대로 고정한다.
버그 수정은 마이그레이션 커밋과 분리된 독립 변경으로 진행하고, 그때 해당 픽스처를 의식적으로 재생성한다.

## 1. [해결됨] `banaPrintCheck` 미정의 → `buildLibraryAsset` 항상 TypeError

**상태: 해결** — `fix(studio): implement missing banaPrintCheck` 커밋에서 convQuality 지표를 재사용하는 `banaPrintCheck` 구현(비어있음·과밀·고립점 검사)과 누락됐던 `banaPass` i18n 키(ko/en)를 추가. `tests/fixtures/baseline/library-asset-v1.json` 픽스처를 성공 케이스로 의식적으로 재생성했고, 회귀 테스트가 Library Asset v1 전체 페이로드를 바이트 단위로 고정한다.

- 위치: `index.html` x-dc 블록
  - 호출부 3곳: `deriveGraphicFeatures()` 내부(라이브러리 에셋 v1의 `graphicFeatures.embossable` 산출), 및 인스펙터 쪽 1곳 (`this.banaPrintCheck(this.cells, 60, 40)`)
  - 정의부: `index.html`, `support.js`, `vendor/`, `corpus*.js` 어디에도 없음 (전 소스 grep으로 확인)
- 현재 런타임 영향:
  - `buildLibraryAsset()` → `deriveGraphicFeatures()` → `TypeError: this.banaPrintCheck is not a function`
  - `exportFormat('JSON')`(라이브러리 에셋 v1 내보내기)은 try/catch로 감싸져 있어 사용자에게는 "Export failed" 토스트로만 나타남 — 즉 **JSON/라이브러리 에셋 내보내기가 현재 main에서 동작하지 않음**
- 회귀 픽스처: `tests/fixtures/baseline/library-asset-v1.json` 은 `{ throws: true, errorName: "TypeError", … }` 형태로 현재 동작을 고정
- 조치 계획: Phase 2(코어 추출)와 무관한 별도 fix 커밋에서 `banaPrintCheck` 구현(BANA 인쇄 최소 규격 검사) 복원 또는 안전한 폴백 결정 → 그 커밋에서 픽스처를 성공 케이스로 재캡처

## 2. Phase 3 sub-step — canvas/WASM codecs (resolved, with one honest limitation)

The original Phase 3 scope note flagged three areas as deferred because they touch a browser `<canvas>` or a WASM/asm.js module. Follow-up status:

- **`window.TSBraille` / liblouis integration — fully captured, real engine.** The vendored engine (`vendor/liblouis/build-no-tables-utf32.js`) is **asm.js, not WASM** — i.e. plain JavaScript — and Node 22 runs it directly once given a real `require` (needed only because Emscripten's own environment detection checks `typeof require === 'function'`, which is absent under ESM; see `src/codecs/braille/liblouis-node.ts`). `src/codecs/braille/liblouis-node.ts` loads the exact same engine file and the exact same 18 table files from disk and calls the real `lou_translateString`. This is not a mock or an approximation — `tests/fixtures/baseline/codec-braille-liblouis.json` contains real translations produced by the real engine, and the parity tests re-run those same translations. The browser adapter (`vendor/liblouis/braille.js`) is untouched.
- **`imgToCells` (image → pin conversion) — fully extracted.** All of the actual algorithm (`_cvGray`, `_cvOtsu`, `_cvDown`, `_cvSobel`, `_cvDilate`, `_cvRemoveSmall`) operates on an already-decoded RGBA buffer, not on a canvas object — so it is pure numeric code, extracted verbatim into `src/codecs/image/image.ts` and parity-tested against synthetic RGBA sources (gradient/checker/circle/transparent patterns) plus a live cross-check against the shipped `_cv*` methods. What is **not** reimplemented is the browser step that turns a JPEG/PNG *file* into that RGBA buffer (`<img>` + `canvas.getContext('2d').drawImage(...).getImageData(...)`) — that's file decoding, not the tactile-conversion algorithm, and stays in `index.html`.
- **`stampText` (묵자 print-text rasterization) — layout extracted, glyph rendering intentionally NOT parity-tested.** `src/codecs/tactile-text/tactile-text.ts` extracts the Hangul-boost row formula, pen advance, inter-glyph gap, and bitmap-to-grid placement — all pure and tested. The one piece left as an **injected dependency** (`GlyphRasterizer`) is turning a character into a coverage bitmap via `ctx.font = "...Pretendard..."` + `getImageData`. This is a deliberate, documented limitation, not an oversight: font hinting and anti-aliasing are rendering-engine-specific (Chrome's Skia vs. any Node-side rasterizer), so claiming byte-identical glyph pixels here would be exactly the "fake compatibility" the migration principles warn against. The real canvas-based `renderGlyph` stays in `index.html`, unchanged.

Net effect: of the three originally-deferred items, liblouis is now genuinely, fully verified; image conversion's actual algorithm is genuinely, fully verified; only glyph-level font rasterization inside `stampText` remains browser-only, and that is an inherent rendering-engine limitation rather than a scope gap.

## 3. DotPad SDK `.d.ts` 불일치 (Phase 4에서 직접 소스 검사로 확인됨)

- **확인 결과**: `vendor/tw/dotpad-sdk.js`를 직접 읽어 확인 — `class DotPadSDK`에 `displayAllUp(device=null)` / `displayAllDown(device=null)`가 실제로 정의되어 있고, 각각 연결된 기기(들)에 `displayTextData('FF'.repeat(...))` + `displayGraphicData('FF'.repeat(...))` (또는 `'00'.repeat(...)`)를 호출한다. 이 저장소에는 `.d.ts` 파일 자체가 없다 (find 결과 0건) — 별도 리포지토리(tw-app 모노레포)에서의 이슈로 추정.
- **앱 레벨 사용**: `vendor/tw/dotpad.js`(`window.TW.DP` 싱글턴)는 `output`/`outputText`/`connect`/`disconnect`/`brailleCellCount`만 감싸고, `displayAllUp`/`displayAllDown`는 감싸지 않는다. index.html도 현재 이 둘을 호출하지 않는다 — 즉 지금까지는 보존해야 할 기존 UI 동작이 없다.
- **Phase 4 처리**: `src/device/dotpad/browser-adapter.ts`의 `raiseAll()`/`lowerAll()`이 이 확인된 메서드를 `DP.sdk.displayAllUp(DP.device)` / `DP.sdk.displayAllDown(DP.device)`로 직접 호출한다(다른 모든 호출은 `DP`를 통함). 메서드 부재 시에는 `not-supported` 에러로 명확히 실패하며, 존재하지 않는 메서드를 새로 만들어내지 않는다.

## 4. `window.TW.DP` 싱글턴의 단일 key-handler 슬롯 (참고, 미변경)

`vendor/tw/dotpad.js`의 `DP.onKey(fn)`은 슬롯이 하나뿐이라 마지막에 등록한 핸들러만 유효하며, `_vis` 플래그로 보호되는 `visibilitychange` 리스너는 페이지 생애주기 동안 한 번만 등록되고 제거되지 않는다(싱글턴 수명과 일치하도록 설계됨). `src/device/dotpad/browser-adapter.ts`는 이 제약을 그대로 인정하고, 모듈 스코프에서 "현재 어떤 어댑터 인스턴스가 그 슬롯을 소유하는지"를 추적해 `dispose()`가 다른 살아있는 인스턴스의 등록을 절대 지우지 않도록만 보장한다 — 싱글턴 자체의 설계를 바꾸지 않는다.

## 5. Phase 5 scope note — reusable React editor

### Phase 5 initial pass

Delivered a real, tested React editor shell: `EditorStore` (framework-agnostic, wraps Phase 2/3 core+codecs), `TactileStudioEditor`/`TactileStudioProvider`/hooks, `StudioCanvas` (verbatim-ported `drawMain`/`evCell` pixel math and pointer wiring), a minimal `Toolbar`, and a development shell.

### Phase 5 continuation — icons, panels, dialogs, poly/text, DotPad

Closed most of the initial pass's deferred list:

- **Icon set**: `src/ui/icons/icons.ts` is a verbatim copy of the monolith's `ICONS` map (SVG path data), rendered via `<Icon>`/`<IconButton>`. No `undo`/`redo` icon exists in that map (the monolith's `aUndo`/`aRedo` announcements exist but no path data was found for them, likely Tabler Icons per the target stack, not yet sourced) — those two buttons use plain glyphs (↶ ↷), documented in code rather than inventing icon paths.
- **Pen/eraser thickness**: a plain segmented 1/2/3 control (not the dot-swatch dropdown popover) wired to `store.setStrokeSize`/`setEraserSize`.
- **Clear/invert/flip**: wired to the already-ported Phase 2 `core/grid` functions via new `EditorStore` commands (`clearAll`/`invertAll`/`flipHoriz`/`flipVert`).
- **Page panel**: list + Add/Delete/Move-up/Move-down + click-to-switch, via a new `goToPage` core operation (verbatim port of the monolith's `goPage`, which clears history on every page switch — confirmed by direct source read) and `EditorStore.setActivePage`. No page-duplication feature exists in the monolith (confirmed by search) — none was invented.
- **Inspector**: page metadata (desc/narration) as plain autosave text fields (`EditorStore.setPageDesc`/`setPageNarration`), and cleanup (thicken/denoise) wired through a new `codecs/grid-fx` module (injected `TW.thickenBits`/`denoiseBits`, never reimplemented) plus a new host-facing `GridFxService`.
- **New `codecs/quality`**: `convQuality`/`banaPrintCheck` extracted as their own pure module (previously only inline in the Phase-1-fix commit's `index.html`), parity-tested against the live shipped methods. Needed by the export dialog's Library Asset v1 `graphicFeatures`.
- **Poly tool**: full pointer-gesture wiring — verbatim port of `updatePolyPreview()`/`closePoly()` (click adds a point, Enter or double-click closes the loop as line-per-edge, Escape cancels), confirmed against the monolith to be an *outline* tool (no fill rasterizer needed).
- **Text tool**: `codecs/tactile-text`'s layout is now wired to a real browser canvas glyph rasterizer (`src/ui/canvas/browser-glyph-rasterizer.ts`, verbatim port of `stampText`'s `renderGlyph` closure) via a minimal inline popover. Injectable for tests (jsdom has no real canvas — same documented limitation as before); parity-tested with a synthetic rasterizer proving the layout math and store wiring.
- **Import dialog**: file picker → `parseLibraryAssetPages` (Phase 3 codec) → `EditorStore.loadPages` (new command, mirrors `importAssetFile`'s page-replacement step: clean undo checkpoint, `pageAudio`/`pageVectors` reset).
- **Export menu**: DTMS and Library Asset v1 export wired to the Phase 3 codecs + the new quality codec; produces JSON strings, leaves the actual file-download trigger (`Blob`/`URL.createObjectURL`) as a small UI-layer convenience, guarded for environments without it.
- **DotPad panel**: connect/disconnect/status/send, wired to the Phase 4 `TactileDisplayAdapter` (works with the real browser adapter or the mock adapter identically).
- **Keyboard shortcuts**: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (and Ctrl+Y) redo, ignoring text-input targets.

### Still deferred (documented, not silently dropped)

- Shape-tool flyout grouping (line/rect/ellipse/poly under one button), the thickness dropdown's dot-swatch styling
- Page thumbnails and drag-and-drop reordering (Move up/down buttons only)
- Confirm-before-delete for pages (deletes immediately; no `ConfirmDialog` wired to it yet, though the component exists)
- Braille "Apply" conversion + preview (desc/narration are plain autosave text; no `BrailleService` wired)
- Image file import (needs `ImageProcessingService` wiring + crop-selection UI)
- SVG/PNG export (PNG needs a real `canvas.toBlob`; SVG needs a `bitsToSVG` port)
- Corpus/command-panel search UI ("명령어로 만들기")
- Full Figma-exact spacing/typography, custom tooltip positioning, focus-trap dialogs, live-region announcements beyond the DotPad status line's `aria-live`
- Confirm dialog is built (`ConfirmDialog.tsx`) but not yet wired into any destructive action

None of this is a regression — `index.html` is untouched and continues to ship with all of the above intact.

### Testing note (jsdom limitation, documented not silently worked around)

`jsdom` implements neither `CanvasRenderingContext2D` nor `PointerEvent`. Tests handle this honestly: `StudioCanvas`'s `draw()` no-ops on a null context (tests verify wiring, not pixels); pointer tests construct `MouseEvent`s with pointer-event type strings (React dispatches by type, not `instanceof`); the text tool's tests inject a synthetic `GlyphRasterizer` rather than exercising the real canvas-based one.

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

- **Icon set**: `src/ui/icons/icons.ts` is a verbatim copy of the monolith's `ICONS` map (SVG path data), rendered via `<Icon>`/`<IconButton>`. Undo/redo (`arrow-back-up`/`arrow-forward-up`-style curved arrows) are now sourced verbatim from the monolith's own current path data too (synced 2026-07-22 — an earlier pass here had ported a close-but-not-identical curve radius from an older monolith state; corrected to match exactly).
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

- Full Figma-exact spacing/typography beyond the design tokens already in use (`--ts-primary`, `--ts-line`, `--ts-surface`, `--ts-ink`, `--ts-bg`, `--ts-danger`) — matching the design system pixel-for-pixel would need direct Figma file access to verify against, which this environment doesn't have. Custom tooltip *positioning* itself is now ported (see round 4 below); what's left here is purely visual fine-tuning (spacing, font sizes, exact color tokens beyond the six above).

### Phase 5 continuation round 2 — corpus search, thumbnails/drag-reorder, braille Apply, SVG/PNG export

Closed the remaining items from the list above at the time:

- **Corpus search**: `codecs/corpus/corpus-search.ts` is a verbatim TypeScript port of the shipped `corpus-search.js` (a real, deterministic, rule-based scoring engine — title/tag/category matching, bilingual aliases and synonyms, a fuzzy near-match "did you mean" path — not a placeholder), parity-tested against the live shipped module with real corpus.js data. `CorpusSearchPanel` wires it to `EditorStore.loadCorpusResult` (a new command mirroring `seedCorpusResult`: decode the hit's DTMS hex, resize to 60×40 if needed, insert as a new page or replace the active one). The corpus data itself is host-supplied via `services.corpus`, never bundled.
- **Page thumbnails**: `PageThumbnail.tsx`, a small real canvas rendering per page (same dot convention as `StudioCanvas`, tiny scale) — same jsdom limitation as the main canvas (no-ops under `getContext('2d') === null`, tests verify wiring/sizing).
- **Drag-and-drop reordering**: pointer-based (not native HTML5 `DragEvent` — jsdom doesn't implement that either, mirroring the earlier `PointerEvent` gap), via a grip handle in `PagePanel`, calling `EditorStore.movePage`. Move-up/down buttons are kept alongside for keyboard/screen-reader operability.
- **Braille "Apply" + preview**: `EditorStore.applyBraille` is a verbatim-semantics port of the monolith's `applyField` (desc-first-then-narration source text regardless of which field triggered Apply, one-Apply-at-a-time busy guard, a stale-response guard for a page switch mid-flight) wired to a host-supplied `BrailleService` in `Inspector`. Never falls back to sending raw text on failure, matching the vendor README's absolute rule.
- **SVG export**: `codecs/svg/svg.ts` orchestrates the injected vendor `TW.bitsToSVG` (same injection pattern as `encodeBits`) — parity-tested against the live shipped function.
- **PNG export**: implemented for real (not deferred) via an offscreen `canvas.toBlob`, since — like the text-tool glyph rasterizer — there's no vendor function to inject and no meaningful cross-engine baseline to parity-test a rendered bitmap against outside a real browser. Documented as such, not silently faked.

### Phase 5 continuation round 3 — shape/thickness flyouts, live-region announcements, confirm-before-delete, image import, corpus prev/next navigation

Closed effectively all of the remaining deferred list:

- **Shape-tool flyout + thickness dropdown**: `Toolbar` now groups line/rect/ellipse/poly behind one button + caret (verbatim UX port of the monolith's `shapeGroup` — the main button shows/reuses the last-selected shape tool), and pen/eraser/shape thickness is a similar flyout showing a `StrokeGroupIcon`/`EraserGroupIcon` (verbatim-ported stacked-bars/nested-squares glyphs reflecting the current 1/2/3 size) instead of always-visible buttons.
- **Live-region announcements**: `EditorStore.announce()` (verbatim-intent port of `say()`) + a new `LiveRegion` component wired into `Toolbar` (tool select, undo/redo, flip/invert/clear) and `PagePanel` (add/switch/move/delete). Core stays i18n-free — components call `announce()` with host-labeled text, never core-generated strings.
- **Focus-trap dialogs**: a shared `useFocusTrap` hook (Tab/Shift+Tab cycling confined to the dialog, focus restored to the trigger on close) applied to `ConfirmDialog` and `ImportDialog`.
- **Confirm-before-delete for pages**: `PagePanel`'s ✕ button now opens `ConfirmDialog`; deletion only happens on confirm.
- **Image file import**: a real (not deferred) browser image decoder (`browser-image-decoder.ts`, File → `<img>` → offscreen canvas → RGBA — same "genuinely browser-only, not parity-tested" category as the text-tool glyph rasterizer and PNG export) feeds the already-pure, already-parity-tested `codecs/image` `imgToCells`, with a pointer-drag crop-selection rectangle over an image preview in `ImportDialog`. `ImageProcessingService` (previously unconsumed) is now genuinely wired as an optional override of the default local codec, extended with a `crop` parameter to match.
- **Corpus context navigation**: `corpusCtxFor`/`corpusGoPage` (verbatim ports) let `CorpusSearchPanel` show Prev/Next controls for a multi-page corpus record's OTHER pages without creating new document pages — parity-tested against the live shipped `corpusCtxFor` using real corpus data.
- **Save wiring**: a Save button + Ctrl/Cmd+S now call `services.storage.save()`, then `EditorStore.markSaved()` and the host's `onSave` callback on success; failures call the host's `onError` (previously accepted but never invoked). `DotPadPanel`'s connect/send failures now also report to the top-level `onError`, in addition to their existing inline error text.

### Phase 5 continuation round 4 — custom tooltips, export-completion callback, hardware key panning

Closed the last three items from the previous round's deferred list:

- **Custom tooltip positioning**: `ui/tooltip/Tooltip.tsx` is a verbatim port of the monolith's `showTip()`/`hideTip()` (a positioned floating bubble, not native `title=""`) — same flip logic (top -> bottom when `r.top < 60`, back to top if bottom would overflow), same horizontal clamping, same show delays (320ms hover / 90ms keyboard focus per the monolith's `focusFast` distinction), same immediate hide. `IconButton` now uses it in place of `title=""` (native title removed to avoid a double tooltip; `aria-label` unchanged for accessibility).
- **Export-completion callback**: `TactileStudioEditorProps` gained `onExport?(result: { format, filename }): void`, called after `ExportMenu`'s own `onExport` triggers the browser download. Informational only, matching the doc comment -- hosts can't alter export behavior from it.
- **Hardware key-driven panning**: `useHardwareKeyPanning` (verbatim port of the monolith's `componentDidMount`'s `window.TW.DP.onKey` block) subscribes to `services.tactileDisplay.subscribeKeys` and maps `PanningLeft`/`PanningRight` to `EditorStore.setActivePage(pageIndex -/+ 1)` -- exactly what the monolith does, nothing more (no behavior invented for `PanningAll` or the function keys, since the monolith doesn't use them for panning either).

## 6. Phase 6 — product-ownership audit (`refactor(studio-integration): remove product ownership`)

Phase 6 asked to remove Studio's ownership of routing, authentication, Supabase, and internal language switching, and to verify embedding inside a parent React route. Since the React layer (Phases 5) was built from scratch under those exact constraints from the start, there was nothing to *remove* — this phase is an **audit**, codified as a regression-guarding test suite (`tests/parity/product-ownership.test.tsx`, 9 tests) rather than a code change:

- **Grep across `src/`** for `react-router-dom`/`HashRouter`/`BrowserRouter`/`useNavigate`/`Supabase`/`supabase` found only comments stating what is *not* done (e.g. "no Supabase import") — zero actual imports or usages. `package.json` has no router or Supabase dependency.
- **No authentication code**: no login/logout/session/token handling anywhere; the one `session` string match is an unrelated comment about localStorage being "session-only" (ephemeral), not user sessions.
- **No internal i18n**: grep for `navigator.language`/language-keyed `localStorage` found only comments; `Toolbar`'s labels come entirely from the `labels` prop with English fallbacks (see Phase 5 continuation).
- **Embedding test**: `TactileStudioEditor` mounts correctly as a plain child of a `HostRoute` stand-in (simulating a Tactile World `react-router-dom` route), renders no navigation of its own, and never calls `history.pushState` or reads `navigator.language`.
- **Host-configurable surface confirmed by test**: `theme` values land as CSS custom properties on the root element; `labels` override English defaults; `onChange`/`onDirtyChange` fire on edits; the editor works with only a `StudioStorageAdapter` (no `tactileDisplay`/`braille`/`imageProcessing`/`gridFx` required).

### New in this phase: a real Vite 5.4 dev server for the development shell

Added `vite.config.ts` (rooted at `dev/`, deliberately isolated from the repo-root vanilla `index.html`) plus `dev/index.html`/`dev/main.tsx` bootstrapping `<DevApp>`. This is a genuinely stronger verification than `tsc --noEmit` alone: `vite build` successfully bundles the full dependency graph (core → codecs → device → storage → react → ui → app/development-shell), 60 modules, and `vite` (dev server) was smoke-tested serving real HMR-wrapped modules over HTTP. The output bundle contains zero references to `DTMS_CORPUS`/`liblouisBuild`/`DotPadSDK` (confirmed by grep) — proving the new React layer pulls in none of the vanilla app's vendor/corpus code. `dist/` is gitignored; this is not yet a packaging config for distributing `<TactileStudioEditor>` itself (no library-mode build/externals) — that remains Phase 7 (or later) work.

### Testing note (jsdom limitation, documented not silently worked around)

`jsdom` implements neither `CanvasRenderingContext2D` nor `PointerEvent`. Tests handle this honestly: `StudioCanvas`'s `draw()` no-ops on a null context (tests verify wiring, not pixels); pointer tests construct `MouseEvent`s with pointer-event type strings (React dispatches by type, not `instanceof`); the text tool's tests inject a synthetic `GlyphRasterizer` rather than exercising the real canvas-based one.

## 7. [해결됨] `LocalLibraryStorageAdapter.save()` — 저장 실패가 완전히 무음 (vanilla와 동일 결함, verbatim 이식됨)

**상태: 해결** — vanilla `main`의 실배포본을 감사하던 중 발견·수정된 `saveLibrary()`/`_saveSession()` 무음 실패 버그와 동일 계열. 이 어댑터는 Phase 4에서 `saveLibrary`를 그대로(버그 포함) verbatim 이식했고(`tests/parity/storage-adapters.test.ts`의 `.resolves.toBeUndefined()` 단언이 그 증거), 이번에 독립 커밋으로 수정한다.

- **문제**: `save()`가 `Promise<void>`를 반환해, quota 초과·private-mode·SSR(윈도우 없음) 등으로 실제 쓰기가 실패해도 호출자가 이를 감지할 방법이 전혀 없었음.
- **수정**: `save(): Promise<boolean>` — 성공 시 `true`, 실패(quota/private-mode/윈도우 없음) 시 `false`.
- **주의**: 이 어댑터는 **아직 React 레이어 어디에서도 소비되지 않음**(`src/react`, `src/ui`에 참조 0건 — grep으로 확인). 즉 UI 단에서 실제로 실패를 표면화하는 배선은 아직 없고, 이번 수정은 향후 소비될 때를 위한 원시(primitive) 계약만 바로잡은 것.
- **회귀 픽스처**: `tests/parity/storage-adapters.test.ts`의 두 케이스를 `.resolves.toBe(false)`로 의식적으로 재작성. 라운드트립 성공 케이스에 `.resolves.toBe(true)` 단언 추가. 전체 스위트 185/185 통과, `tsc --noEmit` 클린.

### 참고: vanilla의 "세션 자동복구(크래시 리커버리)"는 이제 이 모노레포에도 있음

**[갱신: 해결됨]** 아래 단락은 작성 당시(이 항목이 처음 쓰였을 때) 사실이었으나, 이후 `feat(studio): port crash-recovery session autosave from vanilla ecb67e3` 커밋에서 이식 완료됨. `codecs/document/session-snapshot.ts` + `storage/adapters/session-recovery-storage-adapter.ts` + `EditorStore`의 `checkForRecoverableSession`/`restoreSession`/`dismissRecovery` + `ui/recovery/RecoveryBanner.tsx`. 25개 테스트(코덱 패리티 6, 어댑터 7, EditorStore 8, React 통합 4) 추가, 전체 스위트 210/210.

당시 기록(이력 보존): vanilla `_saveSession()`(`ts.session.v1`에 800ms 디바운스로 스냅샷 저장 → 새로고침 시 "이전 작업을 복구할까요?" 배너)에 해당하는 기능이 `src/` 어디에도 없다(session/autosave/recover 관련 grep 결과, `editor-store.ts`의 `dirty` 플래그 추적 외엔 없음). `EditorStore`는 `dirty` 상태와 `onDirtyChange` 콜백만 가지고 있고, 로컬 스토리지 기반 크래시 복구 스냅샷 자체가 아직 없다.

즉 vanilla에서 고친 두 가지 버그 중:
- **`saveLibrary()` 무음 실패** → 이식·수정 완료 (위 항목)
- **`_saveSession()` 무음 실패** → **[해결됨]** 대응 기능 자체를 새로 이식하면서, 처음부터 성공/실패를 boolean으로 반환하는 올바른 계약으로 구현(로컬 라이브러리 어댑터처럼 버그를 verbatim 재현하지 않음 — 이 브랜치엔 참조할 이전 버전이 없었으므로).

## 8. 감사 — DotPad 빠른저장 무음실패 라운드(vanilla 3차 수정)는 이 브랜치에 이식할 코드가 없음

vanilla `main`에서 진행된 세 번째 수정 라운드(`successSaveDrive`/`successAddLibrary` 무음 실패, `say()`/toast 무조건 성공 announce, `ts-save-status`가 `≤1180px`에서 `display:none`이라 모바일에서 에러가 안 보이던 반응형 갭)를 이 브랜치에 이식하려고 확인한 결과, **코드 변경이 필요한 대상이 없었다.** Phase 6 product-ownership 감사와 같은 성격의 "감사 후 무변경" 케이스라 이 항목으로 기록한다.

- **저장 실패 시 거짓 성공 처리 (`doSaveCommit` 버그)**: React 레이어의 저장 흐름(`EditorBody.handleSave`, `TactileStudioEditor.tsx`)은 verbatim 이식이 아니라 Phase 5에서 `{ ok, error }` 계약으로 처음부터 새로 설계됐고, 실패 시 `onError` 호출 + `store.announce(saveFailed)`, 성공 시에만 `markSaved`+`onSave`— 애초에 이 버그 클래스가 없다. `tests/parity/react-editor.test.tsx`의 "a failing storage.save calls onError and never calls onSave" 테스트가 이를 이미 고정 검증하고 있음(재확인: 통과).
- **DotPad 전송 성공 후 빠른저장(`successSaveDrive`/`successAddLibrary`)**: 이 기능 자체가 `src/ui/dotpad/DotPadPanel.tsx`에 없다. `send()`는 전송만 하고 어떤 저장도 트리거하지 않는다(grep 결과 0건) — #7의 세션 자동복구와 같은 성격의 **미이식 기능**이지, 고칠 버그가 아니다.
- **`say()`/toast 무조건 성공 announce**: N/A — 위 항목과 동일 이유로 애초에 해당 코드 경로가 없다.
- **반응형 숨김 갭(`ts-save-status{display:none}` at ≤1180px)**: 이 브랜치의 UI는 전부 인라인 스타일이고 `@media` 쿼리가 `src/ui`, `src/react` 어디에도 없다(grep 확인) — 저장 상태를 반응형으로 숨기는 CSS 자체가 존재하지 않으므로 해당 버그가 성립하지 않는다.

**남은 실제 격차는 DotPad 전송-후-저장 단축 흐름(`successSaveDrive`/`successAddLibrary`) 하나뿐** — 세션 자동복구 자체는 #7 갱신에서 이식 완료됨. 이번 라운드도 버그 수정이 아니라 신규 기능 이식이 필요한 항목임을 재확인.

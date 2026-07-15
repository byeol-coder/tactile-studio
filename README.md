# Tactile Studio Demo

Static GitHub Pages build for the Tactile Studio Demo.

## Run the legacy/vanilla Studio locally

Serve the repository over HTTP from the repository root:

```sh
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

Do not open `index.html` directly with `file://`. The browser liblouis adapter loads braille tables with `fetch()`, and browsers may block those requests under `file://` because of CORS/security restrictions.

## Deployment

This repository deploys from `main` as a static site:

- Entry: `index.html`
- Runtime: `support.js`
- Assets: `assets/`
- Build step: none

The previous Tactile Agent version is preserved at:

- Branch: `backup-before-tactile-studio`
- Tag: `backup-before-tactile-studio-20260705`

## React migration (in progress)

Alongside the deployed app above, this repository also contains a new, incremental migration toward a reusable `<TactileStudioEditor>` React component (see `src/`) for embedding into Tactile World. **The deployed app described above is unaffected** — the migration has left `index.html`/`support.js`/`vendor/` untouched, verified by a fingerprint regression test on every commit and enforced in CI (`.github/workflows/ci.yml`, separate from the Pages `deploy.yml`).

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — folder map, dependency direction, key design decisions
- [`INTEGRATION.md`](./INTEGRATION.md) — how to mount `<TactileStudioEditor>` in a host app
- [`MIGRATION.md`](./MIGRATION.md) — phase-by-phase history and what's been proven compatible
- [`docs/known-issues.md`](./docs/known-issues.md) — living list of known gaps and scope decisions

Quick start for the new layer:

```sh
npm install
npm run typecheck   # TypeScript strict-mode check
npm test            # 185 tests: regression fixtures + live-code parity checks
npm run dev          # Vite dev server for the development shell (mock services, sample doc)
npm run build        # build both the development shell and distributable package
npm run build:dev-shell  # production build of the development shell
npm run build:package    # library-mode ESM build + .d.ts for core/codecs/device/storage/react
```

`npm run build` is the normal handoff check. Maintainers can still run `build:dev-shell` and `build:package` separately when they only need one output.

## Corpus tooling

`corpus.js` is already checked in as the generated runtime artifact used by the vanilla Studio. The original source DTMS directory is not included in this public handoff, and normal Studio execution does not require rebuilding the corpus.

To regenerate `corpus.js`, provide a source directory explicitly:

```sh
node scripts/build-corpus.mjs --src /path/to/dtms
DTMS_SRC=/path/to/dtms node scripts/build-corpus.mjs
```

The corpus builder has no personal-machine default path. Optional Library Asset v1 inputs can be supplied with `--assets <dir>` or `ASSETS_SRC=<dir>`.

## Vendor and SDK facts

- The bundled DotPad SDK is `vendor/tw/dotpad-sdk.js`.
- The bundled SDK identifies itself as `v3.0.0` in its source header comment. No separate formal SDK package manifest is included.
- `displayAllUp()` and `displayAllDown()` exist in the actual bundled SDK.
- liblouis is bundled as an asm.js JavaScript build at `vendor/liblouis/build-no-tables-utf32.js`, not as a `.wasm` binary.
- Required liblouis tables are bundled under `vendor/liblouis/tables/`; no `.wasm` file is expected in the current implementation.
- The vanilla app loads Pretendard CSS from jsDelivr as a cosmetic font dependency. Editor logic does not depend on it; offline runs may fall back to local/system fonts, and a Tactile World host can supply Noto Sans / Noto Sans KR without embedding or redistributing font files here.

## Compatibility note

Library Asset v1 round-trips structured description/narration metadata, but arbitrary unknown top-level Library Asset v1 fields are not guaranteed to survive import/export. That matches the current legacy Studio behavior and is not a React migration regression.

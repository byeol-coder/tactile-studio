<div align="center">

<img src="https://cdn.jsdelivr.net/gh/byeol-coder/tactile-studio@main/assets/tactile-studio-logo.svg" alt="Tactile Studio" width="220">

### Tactile Graphic Agent
시각 정보를 촉각 학습 경험으로 번역하는 독립형 접근성 에디터

A standalone accessibility editor that translates visual information into tactile learning experiences for DotPad devices.

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-byeol--coder.github.io-EC5927?style=for-the-badge)](https://byeol-coder.github.io/tactile-studio/)
[![Studio CI](https://img.shields.io/github/actions/workflow/status/byeol-coder/tactile-studio/ci.yml?branch=main&label=Studio%20CI&style=for-the-badge)](https://github.com/byeol-coder/tactile-studio/actions/workflows/ci.yml)
[![Pages Deploy](https://img.shields.io/github/actions/workflow/status/byeol-coder/tactile-studio/deploy.yml?branch=main&label=Pages%20Deploy&style=for-the-badge)](https://github.com/byeol-coder/tactile-studio/actions/workflows/deploy.yml)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=000)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=fff)](tsconfig.json)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=fff)](vite.config.ts)
[![Vitest](https://img.shields.io/badge/Vitest-210%2B_tests-6E9F18?style=flat-square&logo=vitest&logoColor=fff)](docs/known-issues.md)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=fff)](tests/e2e/editor-smoke.spec.ts)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=fff)](package.json)

</div>

---

## 목차 · Table of Contents

- [Overview](#overview)
- [Two apps, one repository](#two-apps-one-repository)
- [Quick start](#quick-start)
  - [Run the deployed vanilla Studio](#run-the-deployed-vanilla-studio-locally)
  - [Work on the React/TS library](#work-on-the-reactts-library)
- [Documentation](#documentation)
- [Corpus tooling](#corpus-tooling)
- [Vendor and SDK facts](#vendor-and-sdk-facts)
- [Testing and quality gates](#testing-and-quality-gates)
- [Compatibility note](#compatibility-note)

## Overview

**Tactile Studio** is a drawing/editing tool that turns images, shapes, text, and imported graphics into tactile grids that can be sent to a **DotPad** braille/tactile display — built for blind and low-vision users and the educators who prepare materials for them.

This repository ships two things side by side, deliberately:

1. A **deployed vanilla app** (`index.html` / `support.js` / `vendor/`) — live today at [byeol-coder.github.io/tactile-studio](https://byeol-coder.github.io/tactile-studio/).
2. An **incremental React + TypeScript migration** (`src/`) toward a reusable `<TactileStudioEditor>` component for embedding into Tactile World, built by verbatim-porting and parity-testing the vanilla app's algorithms rather than rewriting them from scratch.

## Two apps, one repository

| | Canonical vanilla app | New React layer |
|---|---|---|
| Entry point | `index.html` (~5,700-line buildless `x-dc`/React-via-CDN block) | `src/react/TactileStudioEditor.tsx` |
| Runtime | Compiled by `support.js`'s tiny runtime; React/ReactDOM from `vendor/*.production.min.js` | React 18.3.1, built with Vite 5.4 |
| Deployment | GitHub Pages (`byeol-coder.github.io/tactile-studio/`), also Vercel | Built as a private package (`npm run build:package`); not published to a registry |
| Status | **Ships today.** Left byte-for-byte identical by every migration commit — enforced by a fingerprint regression test | **Handoff-ready.** Real, tested, packaged — see [`docs/known-issues.md`](docs/known-issues.md) for the one remaining visual-polish gap |

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full folder map and dependency direction.

## Quick start

### Run the deployed vanilla Studio locally

Serve the repository over HTTP from the repository root — **not** `file://`, since the browser liblouis adapter loads braille tables with `fetch()`, which browsers may block under `file://` due to CORS/security restrictions:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

**Deployment:** deploys from `main` as a static site — entry `index.html`, runtime `support.js`, assets in `assets/`, no build step. The previous Tactile Agent version is preserved at branch `backup-before-tactile-studio` (tag `backup-before-tactile-studio-20260705`).

### Work on the React/TS library

```sh
npm install
npm run typecheck        # TypeScript strict-mode check
npm test                 # regression fixtures + live-code parity checks (210+ tests)
npm run test:e2e         # Playwright browser + accessibility smoke tests
npm run dev               # Vite dev server for the development shell (mock services, sample doc)
npm run build             # build both the development shell and the distributable package
npm run build:dev-shell   # production build of the development shell only
npm run build:package     # library-mode ESM build + .d.ts for core/codecs/device/storage/react
```

`npm run build` is the normal handoff check. Maintainers can still run `build:dev-shell` and `build:package` separately when they only need one output.

## Documentation

| Doc | What's in it |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Folder map, dependency direction, key design decisions |
| [`INTEGRATION.md`](INTEGRATION.md) | How to mount `<TactileStudioEditor>` in a host app |
| [`MIGRATION.md`](MIGRATION.md) | Phase-by-phase history and what's been proven compatible, and how |
| [`docs/known-issues.md`](docs/known-issues.md) | Living list of known gaps and scope decisions |
| [`docs/IFRAME-EMBED.md`](docs/IFRAME-EMBED.md) | Embedding the vanilla app in an iframe |

## Corpus tooling

`corpus.js` is already checked in as the generated runtime artifact used by the vanilla Studio. The original source DTMS directory is not included in this public handoff, and normal Studio execution does not require rebuilding the corpus.

To regenerate `corpus.js`, provide a source directory explicitly:

```sh
node scripts/build-corpus.mjs --src /path/to/dtms
DTMS_SRC=/path/to/dtms node scripts/build-corpus.mjs
```

The corpus builder has no personal-machine default path. Optional Library Asset v1 inputs can be supplied with `--assets <dir>` or `ASSETS_SRC=<dir>`.

## Vendor and SDK facts

- The bundled DotPad SDK is `vendor/tw/dotpad-sdk.js`, identifying itself as `v3.0.0` in its source header comment (no separate formal SDK package manifest is included).
- `displayAllUp()` and `displayAllDown()` exist in the actual bundled SDK.
- liblouis is bundled as an **asm.js** JavaScript build at `vendor/liblouis/build-no-tables-utf32.js`, not as a `.wasm` binary. Required tables live under `vendor/liblouis/tables/`.
- The vanilla app loads Pretendard CSS from jsDelivr as a cosmetic font dependency. Editor logic does not depend on it; offline runs may fall back to local/system fonts, and a Tactile World host can supply Noto Sans / Noto Sans KR without embedding or redistributing font files here.

## Testing and quality gates

CI (`.github/workflows/ci.yml`) runs on every push and PR into `main`, separate from `deploy.yml` (which only ships the vanilla app to GitHub Pages):

- TypeScript strict-mode typecheck
- `x-dc` syntax check and a WCAG contrast gate for the vanilla app
- Unit + regression + parity tests with a coverage gate (`npm run test:coverage`)
- Dependency audit (`npm audit --omit=dev`)
- Development-shell and library package builds
- A packed-package consumer smoke test
- A guard step that fails the job if any frozen vanilla runtime file (`support.js`, `vendor/`, `corpus*.js`) changed
- A separate job for Playwright browser + accessibility (`@axe-core/playwright`) smoke tests

## Compatibility note

Library Asset v1 round-trips structured description/narration metadata, but arbitrary unknown top-level Library Asset v1 fields are not guaranteed to survive import/export. That matches the current legacy Studio behavior and is not a React migration regression.

---

<div align="center">

Built for tactile-first accessibility · [Architecture](ARCHITECTURE.md) · [Integration guide](INTEGRATION.md) · [Known issues](docs/known-issues.md)

</div>

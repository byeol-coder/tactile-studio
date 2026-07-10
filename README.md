# Tactile Studio Demo

Static GitHub Pages build for the Tactile Studio Demo.

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
npm test            # 177 tests: regression fixtures + live-code parity checks
npm run dev          # Vite dev server for the development shell (mock services, sample doc)
npm run build:dev-shell  # production build of the development shell
npm run build:package    # library-mode ESM build + .d.ts for core/codecs/device/storage/react
```

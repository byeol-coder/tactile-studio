# Dormant modules

Working code intentionally unwired from the app. Kept for future redesign,
excluded from the runtime (no module imports them).

- **sense.js** — audio sonification (hover→sound, audio sweep). Removed from the
  UI because hover-based audio doesn't suit blind users well and isn't part of the
  core loop (prompt → convert → send). The accessibility role it played is now
  covered by `describeTactile()` announced via the `#liveRegion` aria-live element.
  Revisit if reworking into device-side finger tracking or spoken send summaries.

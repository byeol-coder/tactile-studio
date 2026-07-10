// src/codecs — Phase 3 extraction surface (DTMS, Library Asset v1, vector,
// local-library document serialization). Image conversion, tactile-text
// rasterization, and braille/liblouis integration require DOM canvas / WASM
// and are NOT extracted in this phase — see docs/known-issues.md and the
// Phase 3 report for scope notes.
export * from './dtms/dtms.js';
export * from './vector/vectorize.js';
export * from './library-asset-v1/library-asset-v1.js';
export * from './document/local-library.js';

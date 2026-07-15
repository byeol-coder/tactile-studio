// tools/capture-core-baseline.mjs
// Phase 2: record the SHIPPED implementation's core-operation results as
// frozen fixtures. The extracted src/core modules must reproduce every value
// exactly. Regenerate only alongside a reviewed behavior change.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadVendorTW, loadStudioClass, makeInstance, makeLiveInstance,
  seededCells, cellsToBitsPlain,
} from './harness.mjs';
import { geometryCases, pageScript } from './core-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'fixtures', 'baseline');
mkdirSync(OUT, { recursive: true });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const TW = loadVendorTW();
const { Component } = loadStudioClass({ tw: TW });
const proto = Component.prototype;
const hexOf = (cells, w, h) => TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h);

const record = (fn) => { const hits = []; fn((x, y) => hits.push([x, y])); return hits; };

// ── geometry: ordered hit sequences from the shipped rasterizers ────────────
{
  const inst = makeInstance(Component);
  const out = geometryCases().map((c) => ({
    ...c,
    line: sha256(JSON.stringify(record((cb) => proto.line.call(inst, c.x0, c.y0, c.x1, c.y1, cb)))),
    rect: sha256(JSON.stringify(record((cb) => proto.rectOutline.call(inst, c.x0, c.y0, c.x1, c.y1, cb)))),
    ellipse: sha256(JSON.stringify(record((cb) => proto.ellipseOutline.call(inst, c.x0, c.y0, c.x1, c.y1, cb)))),
  }));
  // brush footprints for sizes 1/2/3 (and default 0)
  const brush = [0, 1, 2, 3].map((size) => ({
    size,
    hits: record((cb) => proto.brushCb.call(makeInstance(Component), cb, size)(10, 10)),
  }));
  writeFileSync(path.join(OUT, 'core-geometry.json'), JSON.stringify({ cases: out, brush }, null, 2) + '\n');
  console.log('wrote core-geometry.json');
}

// ── flood fill results (shipped flood mutates instance cells) ───────────────
{
  const w = 60, h = 40;
  const scenarios = [
    { seed: 42, density: 0.2, x: 30, y: 20 },
    { seed: 42, density: 0.2, x: 0, y: 0 },
    { seed: 11, density: 0.35, x: 59, y: 39 },
    { seed: 7, density: 0.05, x: 30, y: 20 },
  ];
  const out = scenarios.map((s) => {
    const inst = makeLiveInstance(Component, { gridW: w, gridH: h });
    inst.cells = seededCells(w, h, s.seed, s.density);
    proto.flood.call(inst, s.x, s.y);
    return { ...s, resultHex: hexOf(inst.cells, w, h) };
  });
  writeFileSync(path.join(OUT, 'core-flood.json'), JSON.stringify({ w, h, scenarios: out }, null, 2) + '\n');
  console.log('wrote core-flood.json');
}

// ── history: scripted snapshot/undo/redo trace (cap 60, redo clearing) ──────
{
  const w = 60, h = 40;
  const inst = makeLiveInstance(Component, { gridW: w, gridH: h });
  inst.bump = () => {};
  const trace = [];
  const log = (step) => trace.push({
    step,
    undoDepth: inst.undoStack.length,
    redoDepth: inst.redoStack.length,
    cellsHex: hexOf(inst.cells, w, h),
  });
  // 70 mutations with snapshots → exercises the 60-entry cap
  for (let i = 0; i < 70; i++) {
    proto.snapshot.call(inst);
    inst.cells[i % (w * h)] = 1;
  }
  log('after-70-snapshots');
  for (let i = 0; i < 5; i++) proto.undo.call(inst);
  log('after-5-undo');
  for (let i = 0; i < 2; i++) proto.redo.call(inst);
  log('after-2-redo');
  proto.snapshot.call(inst); // must clear redo
  inst.cells[500] = 1;
  log('after-snapshot-clears-redo');
  for (let i = 0; i < 100; i++) proto.undo.call(inst); // drain past bottom
  log('after-drain-undo');
  writeFileSync(path.join(OUT, 'core-history.json'), JSON.stringify({ w, h, trace }, null, 2) + '\n');
  console.log('wrote core-history.json');
}

// ── pages: scripted add/delete/move with metadata maps ──────────────────────

{
  const w = 60, h = 40;
  const inst = makeLiveInstance(Component, { gridW: w, gridH: h });
  // seed first page so buffers are distinguishable
  inst.cells.set(seededCells(w, h, 1, 0.1));
  const states = [];
  const snap = (i, op) => states.push({
    i, op,
    pageIndex: inst.state.pageIndex,
    pageCount: inst.pages.length,
    pages: inst.pages.map((p) => sha256(hexOf(p, w, h))),
    audio: JSON.parse(JSON.stringify(inst.pageAudio)), // deep copy — later steps mutate the live map
    vectors: Object.keys(inst.pageVectors),
    activeAliased: inst.cells === inst.pages[inst.state.pageIndex],
  });
  pageScript().forEach((s, i) => {
    if (s.op === 'add') proto.addPage.call(inst);
    else if (s.op === 'delete') proto.deletePageAt.call(inst, s.idx);
    else if (s.op === 'move') proto.movePage.call(inst, s.from, s.to);
    else if (s.op === 'meta') inst.pageAudio[s.page] = { tag: s.tag };
    // mark the newly active page so buffer hashes stay distinguishable
    if (s.op === 'add') inst.cells[i + 1] = 1;
    snap(i, s.op);
  });
  writeFileSync(path.join(OUT, 'core-pages.json'), JSON.stringify({ w, h, states }, null, 2) + '\n');
  console.log('wrote core-pages.json');
}

// ── grid: setGrid resampling chain + flips/invert/clear ─────────────────────
{
  const chain = [[60, 40], [96, 64], [28, 40], [60, 40]];
  const inst = makeLiveInstance(Component, { gridW: 60, gridH: 40 });
  inst.cells.set(seededCells(60, 40, 99, 0.3));
  const steps = [];
  for (let i = 1; i < chain.length; i++) {
    const [w, h] = chain[i];
    proto.setGrid.call(inst, w, h);
    steps.push({ w, h, pagesHex: inst.pages.map((p) => sha256(hexOf(p, w, h))) });
  }
  const w = 60, h = 40;
  const base = seededCells(w, h, 5, 0.25);
  const run = (name) => {
    const li = makeLiveInstance(Component, { gridW: w, gridH: h });
    li.bump = () => {};
    li.cells = base.slice();
    li.pages = [li.cells];
    proto[name].call(li);
    return hexOf(li.cells, w, h);
  };
  writeFileSync(path.join(OUT, 'core-grid.json'), JSON.stringify({
    chainStart: { w: 60, h: 40, seed: 99, density: 0.3 },
    chain: steps,
    fx: { seed: 5, density: 0.25, flipHoriz: run('flipHoriz'), flipVert: run('flipVert'), invertAll: run('invertAll'), clearAll: run('clearAll') },
  }, null, 2) + '\n');
  console.log('wrote core-grid.json');
}

console.log('core baseline capture complete');

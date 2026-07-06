import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeDensity,
  analyzeImageType,
  autoSelectParams,
  autoThinDots,
  components,
  convertToDots,
  createSourceImageStateFromRgba,
  makeGrid,
  tactileQualityScore,
} from '../src/engine.js';

test('parity: makeGrid reports DotPad cell dimensions', () => {
  assert.deepEqual(makeGrid(60, 40), { cols: 60, rows: 40, n: 2400, cc: 30, cr: 10 });
});

test('parity: RGBA source state composites transparent pixels over white', () => {
  const source = createSourceImageStateFromRgba(new Uint8ClampedArray([
    0, 0, 0, 255,
    255, 255, 255, 255,
    0, 0, 0, 0,
    255, 0, 0, 255,
  ]), 2, 2);

  assert.deepEqual([...source.alphaBuf], [255, 255, 0, 255]);
  assert.equal(source.grayBuf[0], 0);
  assert.equal(source.grayBuf[1], 255);
  assert.equal(source.grayBuf[2], 255);
  assert.equal(source.grayBuf[3], 54);
});

test('parity: global threshold conversion preserves connected components', () => {
  const source = {
    grayBuf: new Uint8ClampedArray([0, 128, 200, 255]),
    alphaBuf: new Uint8ClampedArray([255, 255, 255, 255]),
  };
  const dots = convertToDots(source, { method: 'global', threshold: 128, minComp: 2 }, 2, 2);
  assert.deepEqual([...dots], [1, 1, 0, 0]);
});

test('parity: image analyzer classifies high-white sparse artwork as lineart', () => {
  const gray = new Uint8ClampedArray(16).fill(255);
  const alpha = new Uint8ClampedArray(16).fill(255);
  gray[5] = 0;
  gray[6] = 0;
  gray[9] = 0;
  gray[10] = 0;

  const meta = analyzeImageType(gray, alpha, 4, 4);
  assert.equal(meta.hasAlpha, false);
  assert.equal(meta.type, 'lineart');

  const params = autoSelectParams({ grayBuf: gray, alphaBuf: alpha }, 4, 4);
  assert.equal(params.method, 'otsu');
});

test('parity: components, density proofing, and thinning remain deterministic', () => {
  const grid = new Uint8Array(5 * 5);
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) grid[y * 5 + x] = 1;
  }

  const c = components(grid, 5, 5, true);
  assert.equal(c.count, 1);
  assert.deepEqual(c.sizes, [9]);

  const density = analyzeDensity(grid, 5, 5);
  assert.equal(density.on, 9);
  assert.equal(density.crowded, 1);
  assert.equal(density.level, 'mid');

  const thinned = autoThinDots(grid, 5, 5);
  assert.equal(thinned[2 * 5 + 2], 0);
});

test('parity: tactile quality score returns stable grade buckets', () => {
  const grid = new Uint8Array(10 * 4);
  for (let x = 1; x < 9; x++) grid[1 * 10 + x] = 1;
  for (let x = 1; x < 9; x++) grid[2 * 10 + x] = 1;

  const quality = tactileQualityScore(grid, 10, 4, { type: 'lineart', outline: 0 });
  assert.equal(quality.grade >= 2, true);
  assert.equal(quality.m.on, 16);
});

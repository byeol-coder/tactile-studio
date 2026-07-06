import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDtmsJSON,
  dotBit,
  gridToHex,
  hexLengthForResolution,
  hexToGrid,
  inferResolutionFromHexLength,
  parseDtms,
} from '../src/dtms.js';

test('parity: DotPad 2x4 local bit layout matches browser engine', () => {
  assert.equal(dotBit(0, 0), 0);
  assert.equal(dotBit(0, 3), 3);
  assert.equal(dotBit(1, 0), 4);
  assert.equal(dotBit(1, 3), 7);
});

test('parity: gridToHex uses column-major 2x4 cells', () => {
  const grid = new Uint8Array(4 * 4);
  grid[0 * 4 + 0] = 1;
  grid[1 * 4 + 0] = 1;
  grid[2 * 4 + 1] = 1;
  grid[3 * 4 + 1] = 1;
  grid[0 * 4 + 2] = 1;
  grid[3 * 4 + 3] = 1;

  assert.equal(gridToHex(grid, 4, 4), 'C381');
  assert.deepEqual([...hexToGrid('C381', 4, 4)], [...grid]);
});

test('parity: known DotPad HEX lengths infer source resolution', () => {
  assert.equal(hexLengthForResolution({ cols: 60, rows: 40 }), 600);
  assert.deepEqual(inferResolutionFromHexLength(600), { cols: 60, rows: 40, device: 'dotpad320' });
  assert.deepEqual(inferResolutionFromHexLength(1536), { cols: 96, rows: 64, device: 'dotpad320x' });
});

test('parity: DTMS export shape matches browser buildDtmsJSON contract', () => {
  const grid = hexToGrid('C381', 4, 4);
  const json = buildDtmsJSON([{ canvasData: grid, altText: 'outline' }], 'Map', 4, 4);
  const parsed = JSON.parse(json);

  assert.equal(parsed.title, 'Map');
  assert.equal(parsed.lang, 'korean');
  assert.equal(parsed.lang_option, '1');
  assert.equal(parsed.device, 'dotpad320');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0], {
    page: 1,
    title: 'Map',
    graphic: { name: '1.dtm', data: 'C381' },
    text: { name: '1.txt', data: 'outline', plain: 'Map' },
    audio: { fileName: '' },
  });
});

test('parity: parseDtms reads raw HEX, .dtm JSON, and .dtms bundles', () => {
  const raw60x40 = '00'.repeat(300);
  assert.deepEqual(parseDtms(raw60x40), {
    fileName: 'Untitled',
    pages: [{ title: 'Page', hex: raw60x40, altText: '' }],
    cols: 60,
    rows: 40,
  });

  assert.deepEqual(parseDtms(JSON.stringify({ title: 'One', graphic: { data: raw60x40 }, text: { plain: 'alt' } })), {
    fileName: 'One',
    pages: [{ title: 'One', hex: raw60x40, altText: 'alt' }],
    cols: 60,
    rows: 40,
  });

  assert.deepEqual(parseDtms(JSON.stringify({
    title: 'Bundle',
    items: [{ title: 'Page 1', graphic: { data: raw60x40 }, text: { data: 'body' } }],
  })), {
    fileName: 'Bundle',
    pages: [{ title: 'Page 1', hex: raw60x40, altText: 'body' }],
    cols: 60,
    rows: 40,
  });
});

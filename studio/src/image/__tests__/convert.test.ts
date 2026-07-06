import { describe, expect, it } from 'vitest';
import { activeCoords, grayscaleToCells } from '../convert';

const count = (cells: boolean[]) => cells.filter(Boolean).length;

describe('grayscaleToCells — threshold', () => {
  it('raises dark pixels below the threshold', () => {
    // 2×1: one black (0), one white (255), threshold 128
    const cells = grayscaleToCells([0, 255], 2, 1, { threshold: 128, dither: 'none' });
    expect(cells).toEqual([true, false]);
  });

  it('threshold is a strict less-than cut', () => {
    const gray = [100, 128, 200];
    expect(grayscaleToCells(gray, 3, 1, { threshold: 128, dither: 'none' })).toEqual([true, false, false]);
    expect(grayscaleToCells(gray, 3, 1, { threshold: 129, dither: 'none' })).toEqual([true, true, false]);
  });

  it('invert raises light pixels instead', () => {
    const cells = grayscaleToCells([0, 255], 2, 1, { threshold: 128, dither: 'none', invert: true });
    expect(cells).toEqual([false, true]);
  });

  it('all-black → all raised; all-white → none', () => {
    const black = new Array(24).fill(0);
    const white = new Array(24).fill(255);
    expect(count(grayscaleToCells(black, 6, 4, { threshold: 128, dither: 'none' }))).toBe(24);
    expect(count(grayscaleToCells(white, 6, 4, { threshold: 128, dither: 'none' }))).toBe(0);
  });
});

describe('grayscaleToCells — Floyd–Steinberg dither', () => {
  it('output is strictly boolean', () => {
    const ramp = Array.from({ length: 60 * 40 }, (_, i) => (i * 255) / (60 * 40));
    const cells = grayscaleToCells(ramp, 60, 40, { threshold: 128, dither: 'floyd-steinberg' });
    expect(cells).toHaveLength(2400);
    expect(cells.every((c) => c === true || c === false)).toBe(true);
  });

  it('uniform fields still map cleanly (no error to diffuse)', () => {
    const black = new Array(96 * 64).fill(0);
    const white = new Array(96 * 64).fill(255);
    expect(count(grayscaleToCells(black, 96, 64, { threshold: 128, dither: 'floyd-steinberg' }))).toBe(96 * 64);
    expect(count(grayscaleToCells(white, 96, 64, { threshold: 128, dither: 'floyd-steinberg' }))).toBe(0);
  });

  it('a mid-gray field dithers into a mix of raised/lowered', () => {
    const mid = new Array(60 * 40).fill(128);
    const raised = count(grayscaleToCells(mid, 60, 40, { threshold: 128, dither: 'floyd-steinberg' }));
    expect(raised).toBeGreaterThan(0);
    expect(raised).toBeLessThan(2400);
  });
});

describe('activeCoords', () => {
  it('maps a boolean grid to raised coordinates', () => {
    // 3×2 grid, raise (0,0) and (2,1)
    const cells = [true, false, false, false, false, true];
    expect(activeCoords(cells, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
  });
});

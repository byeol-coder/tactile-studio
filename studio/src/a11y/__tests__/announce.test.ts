import { describe, expect, it } from 'vitest';
import { formatBoundary, formatPosition, formatToggle } from '../announce';

describe('cell announcements — Korean', () => {
  it('formats position with 행/열 and 점 있음/점 없음 (1-based)', () => {
    expect(formatPosition('ko', { x: 4, y: 11 }, true)).toBe('12행 5열, 점 있음');
    expect(formatPosition('ko', { x: 0, y: 0 }, false)).toBe('1행 1열, 점 없음');
  });

  it('formats toggle result with 변경됨', () => {
    expect(formatToggle('ko', { x: 4, y: 11 }, true)).toBe('12행 5열, 점 있음으로 변경됨');
    expect(formatToggle('ko', { x: 4, y: 11 }, false)).toBe('12행 5열, 점 없음으로 변경됨');
  });

  it('formats boundary messages', () => {
    expect(formatBoundary('ko', 'lastColumn')).toBe('마지막 열입니다');
    expect(formatBoundary('ko', 'firstRow')).toBe('첫 번째 행입니다');
    expect(formatBoundary('ko', 'outside')).toBe('캔버스 밖으로 이동할 수 없습니다');
  });
});

describe('cell announcements — English', () => {
  it('formats position, toggle, and boundary', () => {
    expect(formatPosition('en', { x: 4, y: 11 }, true)).toBe('Row 12, column 5, dot present');
    expect(formatToggle('en', { x: 4, y: 11 }, false)).toBe('Row 12, column 5 changed to no dot');
    expect(formatBoundary('en', 'lastColumn')).toBe('Last column');
  });
});

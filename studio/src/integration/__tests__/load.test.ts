import { describe, expect, it } from 'vitest';
import { resolveContextLoad } from '../load';

describe('resolveContextLoad — priority', () => {
  it('empty context → blank', () => {
    expect(resolveContextLoad({})).toEqual({ kind: 'blank' });
  });

  it('tactileLayer wins over everything', () => {
    const r = resolveContextLoad({
      tactileLayer: { cells: [] },
      backgroundImage: 'data:image/png;base64,x',
      templateId: 'edu-math-coordinate-plane',
    });
    expect(r.kind).toBe('layer');
  });

  it('backgroundImage wins over templateId when no layer', () => {
    const r = resolveContextLoad({
      backgroundImage: 'data:image/png;base64,x',
      templateId: 'edu-math-coordinate-plane',
    });
    expect(r).toEqual({ kind: 'image', src: 'data:image/png;base64,x' });
  });

  it('templateId is used when only it is present', () => {
    expect(resolveContextLoad({ templateId: 'diagram-flowchart' })).toEqual({
      kind: 'template',
      templateId: 'diagram-flowchart',
    });
  });
});

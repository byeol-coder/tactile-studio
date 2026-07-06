import { describe, expect, it } from 'vitest';
import { dotPadAdapter, buildDtmsContainer } from '../dotpad/DotPadAdapter';
import { embossAdapter, renderSvg } from '../emboss/EmbossAdapter';
import { getDeviceAdapterFor, getOutputAdapter, registerOutputAdapter } from '../registry';
import { frameToHex, docToFrame } from '../../model/frame';
import { createEmptyGrid } from '../../utils/tactileGrid';
import type { TactileDocument } from '../../types/tactile';
import type { FileExport, OutputAdapter } from '../types';

function circleDoc(): TactileDocument {
  const cells = createEmptyGrid('60x40');
  // Raise a diagonal so encode/diff have real content.
  for (let i = 0; i < 40; i++) {
    const c = cells.find((cell) => cell.x === i && cell.y === i);
    if (c) c.active = true;
  }
  return {
    id: 'c',
    title: 'Circle Test',
    resolution: '60x40',
    cells,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('DotPadAdapter', () => {
  it('encode() matches the canonical HEX codec', () => {
    const doc = circleDoc();
    const encoded = dotPadAdapter.encode(doc);
    expect(encoded.hex).toBe(frameToHex(docToFrame(doc)));
    expect(encoded.bytes.length).toBe(300);
    expect(encoded.hex.length).toBe(600);
  });

  it('diff() reports every cell for a null previous frame', () => {
    const encoded = dotPadAdapter.encode(circleDoc());
    expect(dotPadAdapter.diff(null, encoded).length).toBe(60 * 40);
  });

  it('diff() reports only changed cells between frames', () => {
    const a = dotPadAdapter.encode(circleDoc());
    const doc = circleDoc();
    doc.cells[0].active = !doc.cells[0].active; // flip one cell
    const b = dotPadAdapter.encode(doc);
    expect(dotPadAdapter.diff(a, b)).toEqual([0]);
  });

  it('builds a parseable .dtms JSON container', () => {
    const obj = JSON.parse(buildDtmsContainer(circleDoc()));
    expect(obj.device).toBe('dotpad320');
    expect(obj.items[0].graphic.data).toBe(dotPadAdapter.encode(circleDoc()).hex);
  });

  it('connect() yields a working mock handle', async () => {
    const statuses: string[] = [];
    const handle = await dotPadAdapter.connect({ onStatus: (s) => statuses.push(s) });
    expect(statuses).toContain('connected');
    await expect(handle.send(dotPadAdapter.encode(circleDoc()))).resolves.toBeUndefined();
    await handle.disconnect();
    expect(statuses).toContain('disconnected');
  });
});

describe('EmbossAdapter', () => {
  it('renders one <circle> per raised pin', () => {
    const svg = renderSvg(circleDoc());
    const count = (svg.match(/<circle/g) ?? []).length;
    expect(count).toBe(40); // the diagonal set above
    expect(svg).toContain('mm"'); // true-scale millimetre units
  });

  it('exposes svg/pdf/brf and exports svg as a blob', () => {
    expect(embossAdapter.formats).toEqual(['svg', 'pdf', 'brf']);
    const out = embossAdapter.export(circleDoc(), 'svg');
    expect(out.filename).toBe('Circle_Test.svg');
    expect(out.mime).toBe('image/svg+xml');
  });

  it('throws a clear error for stubbed and unknown formats', () => {
    expect(() => embossAdapter.export(circleDoc(), 'pdf')).toThrow(/not implemented/);
    expect(() => embossAdapter.export(circleDoc(), 'brf')).toThrow(/not implemented/);
    expect(() => embossAdapter.export(circleDoc(), 'xyz')).toThrow(/unsupported/);
  });
});

describe('registry', () => {
  it('resolves a device adapter by resolution', () => {
    expect(getDeviceAdapterFor('60x40')?.id).toBe('dotpad');
    expect(getDeviceAdapterFor('96x64')).toBeUndefined();
  });

  it('accepts a new output adapter with zero editor changes', () => {
    const fake: OutputAdapter = {
      id: 'fake-embosser',
      label: 'Fake',
      formats: ['x'],
      export: (): FileExport => ({ filename: 'f.x', mime: 'text/plain', blob: new Blob(['x']) }),
    };
    registerOutputAdapter(fake);
    expect(getOutputAdapter('fake-embosser')).toBe(fake);
  });
});

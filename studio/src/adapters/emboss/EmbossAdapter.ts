import { RESOLUTION_DIMS, type TactileDocument } from '../../types/tactile';
import { docToFrame } from '../../model/frame';
import type { FileExport, OutputAdapter } from '../types';

/**
 * Emboss / swell-paper output adapter.
 *
 * Renders the device-agnostic model to formats a tactile *printer* consumes.
 * SVG is fully implemented; PDF and BRF are documented stubs that throw a clear
 * error, so the extension point is visible and the contract is stable. Wiring a
 * real embosser later = adding a format branch here (or a sibling adapter),
 * with no editor changes.
 *
 * Physical sizing: standard tactile dot pitch is ~2.5 mm. We emit an SVG in
 * millimetre units so it prints at true tactile scale on swell paper / PIAF.
 */
const DOT_PITCH_MM = 2.5;
const DOT_RADIUS_MM = 0.75;
const MARGIN_MM = DOT_PITCH_MM;

function safeName(doc: TactileDocument): string {
  return (doc.title || 'tactile').replace(/[^\w.-]+/g, '_');
}

/** Build a true-scale SVG (mm units) with one filled circle per raised pin. */
export function renderSvg(doc: TactileDocument): string {
  const { width, height } = RESOLUTION_DIMS[doc.resolution];
  const frame = docToFrame(doc);
  const w = (width - 1) * DOT_PITCH_MM + MARGIN_MM * 2;
  const h = (height - 1) * DOT_PITCH_MM + MARGIN_MM * 2;

  const dots: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!frame.bitmap[y * width + x]) continue;
      const cx = (MARGIN_MM + x * DOT_PITCH_MM).toFixed(2);
      const cy = (MARGIN_MM + y * DOT_PITCH_MM).toFixed(2);
      dots.push(`<circle cx="${cx}" cy="${cy}" r="${DOT_RADIUS_MM}" />`);
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">`,
    `  <title>${(doc.title || 'Tactile graphic').replace(/[<&]/g, '')}</title>`,
    `  <g fill="#000000">`,
    ...dots.map((d) => `    ${d}`),
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export class EmbossAdapter implements OutputAdapter {
  readonly id = 'emboss';
  readonly label = 'Embosser / Swell paper';
  readonly formats = ['svg', 'pdf', 'brf'] as const;

  export(doc: TactileDocument, format: string): FileExport {
    switch (format) {
      case 'svg': {
        const svg = renderSvg(doc);
        return {
          filename: `${safeName(doc)}.svg`,
          mime: 'image/svg+xml',
          blob: new Blob([svg], { type: 'image/svg+xml' }),
        };
      }
      case 'pdf':
        // Stub: emit an SVG-vector PDF (or route through a print pipeline) here.
        throw new Error('EmbossAdapter: PDF export not implemented yet (v0 stub).');
      case 'brf':
        // Stub: braille-ready-format for embossers with a text/braille layer.
        throw new Error('EmbossAdapter: BRF export not implemented yet (v0 stub).');
      default:
        throw new Error(`EmbossAdapter: unsupported format "${format}".`);
    }
  }
}

export const embossAdapter = new EmbossAdapter();

import { RESOLUTION_DIMS, type TactileDocument, type TactileResolution } from '../types/tactile';
import { computeQuality } from './tactileGrid';

/**
 * Parse a project JSON file (as produced by exportJson) into a TactileDocument.
 * Returns null if the payload is missing required fields. Quality is
 * recomputed if absent so loaded docs always show a summary.
 */
export function parseProjectFile(text: string): TactileDocument | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<TactileDocument>;
  if (!Array.isArray(d.cells) || d.cells.length === 0) return null;
  const resolution: TactileResolution =
    d.resolution && d.resolution in RESOLUTION_DIMS ? d.resolution : '60x40';
  const now = new Date().toISOString();
  return {
    id: d.id ?? `doc-open-${text.length}`,
    title: d.title ?? '가져온 프로젝트',
    resolution,
    cells: d.cells,
    sourceImageName: d.sourceImageName,
    quality: d.quality ?? computeQuality(d.cells, resolution),
    createdAt: d.createdAt ?? now,
    updatedAt: now,
  };
}

import { DTMS_CORPUS } from './dtmsCorpus.generated';
import type { CorpusGraphic } from './types';

export type { CorpusGraphic, CorpusPage, CorpusCategory } from './types';

/**
 * The bundled DTMS corpus (single import seam). Generated offline by
 * `scripts/ingest-dtms.mjs`; searched in-memory by {@link file://./search.ts}.
 */
export function getCorpus(): CorpusGraphic[] {
  return DTMS_CORPUS;
}

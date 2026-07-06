import {
  RESOLUTION_DIMS,
  type TactileDocument,
  type TactileResolution,
} from '../types/tactile';
import type { CursorPos } from '../a11y/cursor';
import type { Language } from '../i18n/messages';
import { computeQuality, createEmptyGrid } from '../utils/tactileGrid';
import {
  getTemplate,
  toPendingConversionPreset,
  type PendingConversionPreset,
  type TactileTemplateDefinition,
} from './catalog';

let seq = 0;

/** Pick a safe resolution for a template given a requested grid size. */
export function resolveTemplateResolution(
  template: TactileTemplateDefinition,
  requested?: TactileResolution,
): TactileResolution {
  if (requested && template.supportedGridSizes.includes(requested)) return requested;
  return template.defaultGridSize;
}

/**
 * Generate a canonical {@link TactileDocument} from a template at the given
 * resolution. Cells are clamped in-bounds. `conversion-preset` templates have
 * no generator and return null (they are not loadable as documents).
 */
/**
 * Build a canonical dense {@link TactileDocument} from a list of raised-cell
 * coordinates at the given resolution. Out-of-bounds coordinates are dropped
 * (safety clamp) so callers may pass generator output freely. Shared by the
 * template loader and the command generator so the clamp/quality/shape logic
 * lives in exactly one place.
 */
export function buildDocumentFromCoords(
  coords: CursorPos[],
  resolution: TactileResolution,
  title: string,
  idPrefix = 'doc',
): TactileDocument {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const cells = createEmptyGrid(resolution);
  for (const { x, y } of coords) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue; // safety clamp
    cells[y * width + x].active = true;
  }
  const now = new Date().toISOString();
  return {
    id: `${idPrefix}-${++seq}`,
    title,
    resolution,
    cells,
    quality: computeQuality(cells, resolution),
    createdAt: now,
    updatedAt: now,
  };
}

export function templateToDocument(
  template: TactileTemplateDefinition,
  resolution: TactileResolution,
  lang: Language = 'ko',
): TactileDocument | null {
  if (!template.generate) return null;
  return buildDocumentFromCoords(
    template.generate(resolution),
    resolution,
    template.title[lang] ?? template.title.ko,
    `doc-tpl-${template.id}`,
  );
}

/**
 * What loading a template id should do. `conversion-preset` templates arm the
 * image pipeline (no cells generated); everything else becomes a document.
 * `error` covers unknown ids and malformed definitions. Pure + deterministic so
 * the App effect and the empty-state picker share one decision (no duplication).
 */
export type TemplateLoadPlan =
  | { kind: 'document'; document: TactileDocument }
  | { kind: 'preset'; preset: PendingConversionPreset }
  | { kind: 'error' };

export function planTemplateLoad(
  templateId: string,
  requestedGridSize: TactileResolution | undefined,
  lang: Language = 'ko',
): TemplateLoadPlan {
  const template = getTemplate(templateId);
  if (!template) return { kind: 'error' };
  if (template.assetType === 'conversion-preset') {
    const preset = toPendingConversionPreset(template);
    return preset ? { kind: 'preset', preset } : { kind: 'error' };
  }
  const resolution = resolveTemplateResolution(template, requestedGridSize);
  const document = templateToDocument(template, resolution, lang);
  return document ? { kind: 'document', document } : { kind: 'error' };
}

import type { CursorPos } from '../a11y/cursor';
import { RESOLUTION_DIMS, type TactileDocument, type TactileResolution } from '../types/tactile';
import type { Language } from '../i18n/messages';
import { bresenhamLine, ellipseCells, rectCells } from '../geometry/raster';
import { drawShapeGrid } from '../utils/tactileGrid';
import { getTemplate, type Bilingual } from '../templates/catalog';
import { buildDocumentFromCoords } from '../templates/load';

/**
 * Command-based tactile graphic generation (v1 — deterministic, local, NO AI
 * backend). A short natural-language prompt is matched against a small keyword
 * table to pick an intent, then generated into raised cells via existing
 * template generators, the shape generator, or a few built-in generators. The
 * output flows into the canonical document pipeline and is fully editable.
 *
 * The `resolveGenerationIntent` → intent contract is the seam where a real NLU
 * / LLM parser can later replace the keyword matcher without touching callers.
 */

export type GenerationIntentId =
  | 'coordinate-plane'
  | 'number-line'
  | 'basic-shapes'
  | 'cat-face'
  | 'star'
  | 'tree'
  | 'flowchart'
  | 'timeline'
  | 'cell-diagram'
  | 'building-facade'
  | 'fallback';

/** Optional authoring purpose (biases the fallback draft when nothing matches). */
export type GenerationPurpose = 'lesson' | 'diagram' | 'map' | 'object' | 'museum' | 'guide';

interface GenIntentDef {
  id: GenerationIntentId;
  title: Bilingual;
  /** Lowercase keywords (KO + EN) matched as substrings of the prompt. */
  keywords: string[];
  generate: (res: TactileResolution) => CursorPos[];
}

// ── built-in generators (fraction-of-dimensions → adapt to 60×40 and 96×64) ──
const dims = (res: TactileResolution) => RESOLUTION_DIMS[res];

/** Delegate to a catalog template's own generator (single source of truth). */
function fromTemplate(id: string): (res: TactileResolution) => CursorPos[] {
  return (res) => getTemplate(id)?.generate?.(res) ?? [];
}

/** Star reuses the tested primitive shape generator, as raised coords. */
function star(res: TactileResolution): CursorPos[] {
  return drawShapeGrid('star', res).filter((c) => c.active).map((c) => ({ x: c.x, y: c.y }));
}

/** A simple, tactile-legible cat face: head, ears, eyes, nose, whiskers. */
function catFace(res: TactileResolution): CursorPos[] {
  const { width: W, height: H } = dims(res);
  const cx = (W / 2) | 0;
  const cy = (H * 0.56) | 0;
  const rx = Math.max(6, (W * 0.26) | 0);
  const ry = Math.max(6, (H * 0.3) | 0);
  const earH = Math.max(4, (H * 0.16) | 0);
  const earTop = cy - ry;
  const out: CursorPos[] = [...ellipseCells({ x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy + ry }, false)];
  // ears (two triangles peaking above the head)
  const earInL = cx - ((rx * 0.35) | 0);
  const earInR = cx + ((rx * 0.35) | 0);
  out.push(...bresenhamLine(cx - rx + 1, earTop, cx - rx - 1, earTop - earH));
  out.push(...bresenhamLine(cx - rx - 1, earTop - earH, earInL, earTop));
  out.push(...bresenhamLine(cx + rx - 1, earTop, cx + rx + 1, earTop - earH));
  out.push(...bresenhamLine(cx + rx + 1, earTop - earH, earInR, earTop));
  // eyes (short vertical strokes), nose, whiskers
  const eyeY = cy - ((ry * 0.15) | 0);
  const eyeDx = Math.max(2, (rx * 0.42) | 0);
  out.push({ x: cx - eyeDx, y: eyeY }, { x: cx - eyeDx, y: eyeY - 1 });
  out.push({ x: cx + eyeDx, y: eyeY }, { x: cx + eyeDx, y: eyeY - 1 });
  const noseY = cy + ((ry * 0.22) | 0);
  out.push({ x: cx, y: noseY });
  out.push(...bresenhamLine(cx - 2, noseY, cx - rx, noseY - 1));
  out.push(...bresenhamLine(cx + 2, noseY, cx + rx, noseY - 1));
  out.push(...bresenhamLine(cx - 2, noseY + 2, cx - rx, noseY + 2));
  out.push(...bresenhamLine(cx + 2, noseY + 2, cx + rx, noseY + 2));
  return out;
}

/** A simple tree: rectangular trunk + triangular canopy. */
function tree(res: TactileResolution): CursorPos[] {
  const { width: W, height: H } = dims(res);
  const cx = (W / 2) | 0;
  const base = (H * 0.9) | 0;
  const trunkTop = (H * 0.62) | 0;
  const trunkW = Math.max(1, (W * 0.045) | 0);
  const canopyTop = (H * 0.12) | 0;
  const canopyW = Math.max(6, (W * 0.3) | 0);
  return [
    ...rectCells({ x: cx - trunkW, y: trunkTop }, { x: cx + trunkW, y: base }, false),
    ...bresenhamLine(cx, canopyTop, cx - canopyW, trunkTop),
    ...bresenhamLine(cx, canopyTop, cx + canopyW, trunkTop),
    ...bresenhamLine(cx - canopyW, trunkTop, cx + canopyW, trunkTop),
  ];
}

/** Fallback starter draft: an inset labelled frame with a centred object mark. */
function fallbackFrame(res: TactileResolution): CursorPos[] {
  const { width: W, height: H } = dims(res);
  const cx = (W / 2) | 0;
  const cy = (H / 2) | 0;
  const r = Math.max(4, (Math.min(W, H) * 0.18) | 0);
  return [
    ...rectCells({ x: 1, y: 1 }, { x: W - 2, y: H - 2 }, false),
    ...ellipseCells({ x: cx - r, y: cy - r }, { x: cx + r, y: cy + r }, false),
  ];
}

// ── intent table (order = tie-break priority) ───────────────────────────────
const INTENTS: GenIntentDef[] = [
  {
    id: 'coordinate-plane',
    title: { ko: '좌표평면', en: 'Coordinate plane' },
    keywords: ['coordinate plane', 'coordinate', 'axes', 'x축', 'y축', '좌표평면', '좌표'],
    generate: fromTemplate('edu-math-coordinate-plane'),
  },
  {
    id: 'number-line',
    title: { ko: '수직선', en: 'Number line' },
    keywords: ['number line', 'numberline', '수직선', '수 직선', '수선'],
    generate: fromTemplate('edu-math-number-line'),
  },
  {
    id: 'basic-shapes',
    title: { ko: '기본 도형', en: 'Basic shapes' },
    keywords: ['basic shapes', 'basic shape', 'shapes', '기본 도형', '도형'],
    generate: fromTemplate('edu-math-basic-geometry'),
  },
  {
    id: 'cell-diagram',
    title: { ko: '세포 구조', en: 'Cell diagram' },
    keywords: ['plant cell', 'cell diagram', 'cell', '식물 세포', '세포 구조', '세포'],
    generate: fromTemplate('edu-sci-cell'),
  },
  {
    id: 'flowchart',
    title: { ko: '순서도', en: 'Flowchart' },
    keywords: ['flowchart', 'flow chart', 'flow', '순서도', '흐름도'],
    generate: fromTemplate('diagram-flowchart'),
  },
  {
    id: 'timeline',
    title: { ko: '타임라인', en: 'Timeline' },
    keywords: ['timeline', 'time line', '타임라인', '연표', '시간축'],
    generate: fromTemplate('diagram-timeline'),
  },
  {
    id: 'building-facade',
    title: { ko: '건물 정면', en: 'Building facade' },
    keywords: ['building facade', 'building', 'facade', 'heritage', 'museum', 'exhibit', '건물 정면', '건물', '정면', '박물관', '전시', '유산'],
    generate: fromTemplate('heritage-building-facade'),
  },
  {
    id: 'cat-face',
    title: { ko: '고양이 얼굴', en: 'Cat face' },
    keywords: ['cat face', 'cat', 'kitten', 'animal face', '고양이', '동물 얼굴', '동물'],
    generate: catFace,
  },
  {
    id: 'tree',
    title: { ko: '나무', en: 'Tree' },
    keywords: ['tree', '나무'],
    generate: tree,
  },
  {
    id: 'star',
    title: { ko: '별', en: 'Star' },
    keywords: ['star', '별'],
    generate: star,
  },
];

const FALLBACK: GenIntentDef = {
  id: 'fallback',
  title: { ko: '기본 초안', en: 'Starter draft' },
  keywords: [],
  generate: fallbackFrame,
};

/** Purpose → the generator used for an unmatched (fallback) prompt. */
const PURPOSE_FALLBACK: Partial<Record<GenerationPurpose, GenerationIntentId>> = {
  museum: 'building-facade',
  diagram: 'flowchart',
  map: 'coordinate-plane',
  object: 'star',
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** True when a prompt has no usable content. */
export function isBlankPrompt(prompt: string): boolean {
  return norm(prompt).length === 0;
}

export interface ResolvedIntent {
  id: GenerationIntentId;
  title: Bilingual;
  isFallback: boolean;
}

/**
 * Match a prompt to a generation intent. Never throws. Unmatched prompts return
 * a fallback intent (biased by `purpose` when provided), flagged isFallback.
 */
export function resolveGenerationIntent(prompt: string, purpose?: GenerationPurpose): ResolvedIntent {
  const q = norm(prompt);
  let best: GenIntentDef | null = null;
  let bestScore = 0;
  if (q) {
    for (const def of INTENTS) {
      let score = 0;
      for (const kw of def.keywords) {
        const k = norm(kw);
        if (k && q.includes(k)) score = Math.max(score, k.length);
      }
      if (score > bestScore) {
        bestScore = score;
        best = def;
      }
    }
  }
  if (best) return { id: best.id, title: best.title, isFallback: false };

  // Nothing matched — pick a purpose-appropriate starter draft.
  const purposeId = purpose ? PURPOSE_FALLBACK[purpose] : undefined;
  const fb = purposeId ? INTENTS.find((d) => d.id === purposeId) ?? FALLBACK : FALLBACK;
  return { id: fb.id, title: fb.title, isFallback: true };
}

function defById(id: GenerationIntentId): GenIntentDef {
  return INTENTS.find((d) => d.id === id) ?? FALLBACK;
}

export interface GenerationResult {
  document: TactileDocument;
  intentId: GenerationIntentId;
  isFallback: boolean;
}

/**
 * Generate an editable {@link TactileDocument} from a command prompt. Cells are
 * clipped to grid bounds by {@link buildDocumentFromCoords}. Returns null only
 * for a blank prompt (callers should validate first and surface guidance);
 * everything else — including unrecognised prompts — yields a safe draft.
 */
export function generateFromCommand(
  prompt: string,
  resolution: TactileResolution,
  lang: Language = 'ko',
  purpose?: GenerationPurpose,
): GenerationResult | null {
  if (isBlankPrompt(prompt)) return null;
  const resolved = resolveGenerationIntent(prompt, purpose);
  const def = defById(resolved.id);
  const coords = def.generate(resolution);
  const title = resolved.title[lang] ?? resolved.title.ko;
  const document = buildDocumentFromCoords(coords, resolution, title, `doc-cmd-${resolved.id}`);
  return { document, intentId: resolved.id, isFallback: resolved.isFallback };
}

/** Example prompts for the panel's chips (each resolves to a real intent). */
export const GENERATION_EXAMPLES: Bilingual[] = [
  { ko: '좌표평면 만들어줘', en: 'Create a coordinate plane' },
  { ko: '고양이 얼굴 그려줘', en: 'Draw a simple cat face' },
  { ko: '식물 세포 구조', en: 'Plant cell diagram' },
  { ko: '순서도 만들어줘', en: 'Make a flowchart' },
  { ko: '박물관 전시용 건물 정면', en: 'Museum building facade' },
  { ko: '나무 그려줘', en: 'Draw a tree' },
];

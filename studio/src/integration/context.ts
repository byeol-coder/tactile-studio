import type { Language, ToolId } from '../i18n/messages';
import type { TactileResolution } from '../types/tactile';
import type { ActivationSourceType, ExportTarget } from '../analytics/activation';

/**
 * TactileStudioContext (spec §B) — the parameters Tactile World's hub (Dot
 * Library / Play) passes into Studio to seed a session, via query string and
 * (Phase 6) postMessage. Every field is optional: an empty context is a blank
 * `sourceType: 'blank'` entry.
 *
 * Phase 0~1 scope: define the type, parse + validate it from the query string,
 * enforce the parentOrigin allowlist, and inherit the safe parts (language,
 * grid size, activation source). The live postMessage bridge lands in Phase 6.
 */
export type PreviewState = 'draft' | 'converting' | 'reviewing' | 'ready';
export type UsageMode = 'edit' | 'view' | 'play-embed';

export interface TactilePageMeta {
  title?: string;
  subject?: string;
  sourceUrl?: string;
  author?: string;
  createdAt?: string;
  locale?: string;
}

export interface TactileStudioContext {
  /** Where the user came from. */
  sourceType?: ActivationSourceType;
  /** Subject template / sample identifier. */
  templateId?: string;
  /** Image to convert (URL or data ref). */
  backgroundImage?: string;
  /** Grid spec to open at. */
  gridSize?: TactileResolution;
  /** Pin depth (e.g. 32). */
  pinDepth?: number;
  /** Existing tactile layer — same schema as TactileDocument (lossless round-trip). */
  tactileLayer?: unknown;
  /** Page metadata. */
  pageMeta?: TactilePageMeta;
  /** Inherited UI language. */
  lang?: Language;
  /** Workflow step to sync to. */
  previewState?: PreviewState;
  /** Default output target. */
  exportTarget?: ExportTarget;
  /** Edit / view / game-embed mode. */
  usageMode?: UsageMode;
  /** Return URL after completion. */
  returnUrl?: string;
  /** Parent origin — validated against the allowlist. */
  parentOrigin?: string;
  /** Tactile Drive asset / session linkage. */
  assetId?: string;
  sessionToken?: string;
  /** Embed-shell flags (Tactile World convention `?embed=1&preview=0`). */
  embed?: boolean;
  preview?: boolean;
}

/** Origins permitted to embed Studio / send it context (allowlist-enforced). */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://tactileworld.org',
  'https://www.tactileworld.org',
  'https://byeol-coder.github.io',
];

/** True if `origin` is on the allowlist. Empty/unknown origins are rejected. */
export function isAllowedOrigin(origin: string | null | undefined, allowlist: readonly string[] = DEFAULT_ALLOWED_ORIGINS): boolean {
  if (!origin) return false;
  return allowlist.includes(origin);
}

const RESOLUTIONS: TactileResolution[] = ['60x40', '96x64'];
const SOURCE_TYPES: ActivationSourceType[] = ['library', 'play', 'template', 'upload', 'blank'];
const EXPORT_TARGETS: ExportTarget[] = ['dotpad', 'emboss', 'file'];
const USAGE_MODES: UsageMode[] = ['edit', 'view', 'play-embed'];
const PREVIEW_STATES: PreviewState[] = ['draft', 'converting', 'reviewing', 'ready'];
const LANGS: Language[] = ['ko', 'en'];

function oneOf<T extends string>(value: string | null, allowed: T[]): T | undefined {
  return value !== null && (allowed as string[]).includes(value) ? (value as T) : undefined;
}

function bool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === '1' || value === 'true';
}

function json<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined; // malformed → ignored, not fatal
  }
}

/**
 * Parse + validate a TactileStudioContext from a query string. Unknown/invalid
 * values are dropped (never throws). `search` may include the leading `?`.
 */
export function parseContext(search: string): TactileStudioContext {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const ctx: TactileStudioContext = {};

  const sourceType = oneOf(p.get('sourceType'), SOURCE_TYPES);
  if (sourceType) ctx.sourceType = sourceType;

  const templateId = p.get('templateId');
  if (templateId) ctx.templateId = templateId;

  const backgroundImage = p.get('backgroundImage');
  if (backgroundImage) ctx.backgroundImage = backgroundImage;

  const gridSize = oneOf(p.get('gridSize'), RESOLUTIONS);
  if (gridSize) ctx.gridSize = gridSize;

  const pinDepthRaw = p.get('pinDepth');
  if (pinDepthRaw !== null) {
    const n = Number(pinDepthRaw);
    if (Number.isFinite(n) && n > 0) ctx.pinDepth = n;
  }

  const tactileLayer = json<unknown>(p.get('tactileLayer'));
  if (tactileLayer !== undefined) ctx.tactileLayer = tactileLayer;

  const pageMeta = json<TactilePageMeta>(p.get('pageMeta'));
  if (pageMeta && typeof pageMeta === 'object') ctx.pageMeta = pageMeta;

  const lang = oneOf(p.get('lang'), LANGS);
  if (lang) ctx.lang = lang;

  const previewState = oneOf(p.get('previewState'), PREVIEW_STATES);
  if (previewState) ctx.previewState = previewState;

  const exportTarget = oneOf(p.get('exportTarget'), EXPORT_TARGETS);
  if (exportTarget) ctx.exportTarget = exportTarget;

  let usageMode = oneOf(p.get('usageMode'), USAGE_MODES);

  const returnUrl = p.get('returnUrl');
  if (returnUrl) ctx.returnUrl = returnUrl;

  const parentOrigin = p.get('parentOrigin');
  if (parentOrigin) ctx.parentOrigin = parentOrigin;

  const assetId = p.get('assetId');
  if (assetId) ctx.assetId = assetId;

  const sessionToken = p.get('sessionToken');
  if (sessionToken) ctx.sessionToken = sessionToken;

  const embed = bool(p.get('embed'));
  if (embed !== undefined) ctx.embed = embed;
  const preview = bool(p.get('preview'));
  if (preview !== undefined) ctx.preview = preview;

  // Derive a usage mode from the embed/preview convention when not explicit.
  if (!usageMode) {
    if (preview) usageMode = 'view';
    else if (embed) usageMode = 'edit';
  }
  if (usageMode) ctx.usageMode = usageMode;

  return ctx;
}

/** Tool implied by a view-only usage mode (read-only navigation). */
export function toolForUsageMode(mode: UsageMode | undefined): ToolId | undefined {
  return mode === 'view' ? 'cursor' : undefined;
}

/**
 * Validate + parse a postMessage payload as context (Phase 6 seam). Returns
 * null if the origin is not allowlisted or the payload isn't a context message.
 * NOT wired to a live listener yet — the bridge is Phase 6.
 */
export function parseContextMessage(
  event: { origin: string; data: unknown },
  allowlist: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): TactileStudioContext | null {
  if (!isAllowedOrigin(event.origin, allowlist)) return null;
  const data = event.data as { type?: string; context?: TactileStudioContext } | null;
  if (!data || data.type !== 'tactile-studio/context' || typeof data.context !== 'object') return null;
  return data.context;
}

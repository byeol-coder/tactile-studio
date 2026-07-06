import type { TactileStudioContext } from './context';

/**
 * What Studio should load from the entry context, by priority (spec-decided):
 *   1. tactileLayer   — already a tactile document (most specific)
 *   2. backgroundImage — a concrete source asset that needs conversion
 *   3. templateId      — a starter state
 *   4. blank           — fallback
 */
export type ContextLoad =
  | { kind: 'layer'; layer: unknown }
  | { kind: 'image'; src: string }
  | { kind: 'template'; templateId: string }
  | { kind: 'blank' };

export function resolveContextLoad(ctx: TactileStudioContext): ContextLoad {
  if (ctx.tactileLayer != null) return { kind: 'layer', layer: ctx.tactileLayer };
  if (ctx.backgroundImage) return { kind: 'image', src: ctx.backgroundImage };
  if (ctx.templateId) return { kind: 'template', templateId: ctx.templateId };
  return { kind: 'blank' };
}

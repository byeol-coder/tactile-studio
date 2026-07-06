import type { TactileResolution } from '../types/tactile';

/**
 * Activation tracking (spec §C).
 *
 * The finalized 2026-07 activation metric is **"DotPad 출력 성공"** — the moment
 * a graphic is streamed to a real DotPad (BLE) or a real-device preview
 * succeeds. Save is a *retention* signal, not activation.
 *
 * This module is the client-side seam that records that moment. It fires once
 * per session (the first successful output), computes `timeToActivationMs` from
 * session start, and notifies listeners. There is no backend in Phase 0~1, so a
 * listener just logs in dev; Phase 6 wires real analytics by subscribing here —
 * nothing upstream changes.
 *
 * Attributes match §C: `sourceType`, `templateId`, `gridSize`, `exportTarget`,
 * `timeToActivationMs`. `sourceType`/`templateId` are populated from
 * {@link setActivationContext} once TactileStudioContext (spec §B) is parsed;
 * until then they default to a blank entry.
 */
export type ExportTarget = 'dotpad' | 'emboss' | 'file';
export type ActivationSourceType = 'library' | 'play' | 'template' | 'upload' | 'blank';

/** What the caller knows at the moment of a successful output. */
export interface OutputSuccess {
  exportTarget: ExportTarget;
  gridSize: TactileResolution;
  /** Overrides the session context source, if known at call time. */
  sourceType?: ActivationSourceType;
  templateId?: string;
}

/** The one-time activation event emitted on first successful output. */
export interface ActivationEvent {
  type: 'activation';
  sourceType: ActivationSourceType;
  templateId?: string;
  gridSize: TactileResolution;
  exportTarget: ExportTarget;
  timeToActivationMs: number;
  /** ISO timestamp of activation. */
  at: string;
}

type Listener = (event: ActivationEvent) => void;

interface SessionContext {
  sourceType: ActivationSourceType;
  templateId?: string;
}

let now: () => number = () => Date.now();
let sessionStart: number | null = null;
let activated: ActivationEvent | null = null;
let context: SessionContext = { sourceType: 'blank' };
const listeners = new Set<Listener>();

/** Begin (or restart) the activation window; resets any prior activation. */
export function startSession(): void {
  sessionStart = now();
  activated = null;
}

/**
 * Set the entry context (spec §B). Called after TactileStudioContext is parsed
 * so activation events carry the real source/template. Safe to call anytime
 * before activation fires.
 */
export function setActivationContext(ctx: Partial<SessionContext>): void {
  context = { ...context, ...ctx };
}

/** Subscribe to activation; returns an unsubscribe fn. */
export function onActivation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Record a successful output (DotPad send or real-device preview). Fires the
 * activation event only on the *first* success in the session; later successes
 * are engagement, not activation, and return null.
 */
export function recordOutputSuccess(success: OutputSuccess): ActivationEvent | null {
  if (activated) return null;
  const start = sessionStart ?? now();
  const event: ActivationEvent = {
    type: 'activation',
    sourceType: success.sourceType ?? context.sourceType,
    templateId: success.templateId ?? context.templateId,
    gridSize: success.gridSize,
    exportTarget: success.exportTarget,
    timeToActivationMs: Math.max(0, now() - start),
    at: new Date(now()).toISOString(),
  };
  activated = event;
  for (const listener of listeners) listener(event);
  return event;
}

export function hasActivated(): boolean {
  return activated !== null;
}

export function getActivation(): ActivationEvent | null {
  return activated;
}

/** Test seam: override the clock. Pass no argument to restore `Date.now`. */
export function configureClock(clock?: () => number): void {
  now = clock ?? (() => Date.now());
}

/** Test seam: clear all state (session, activation, context, listeners). */
export function resetActivation(): void {
  sessionStart = null;
  activated = null;
  context = { sourceType: 'blank' };
  listeners.clear();
}

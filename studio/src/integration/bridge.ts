import {
  DEFAULT_ALLOWED_ORIGINS,
  isAllowedOrigin,
  parseContextMessage,
  type PreviewState,
  type TactileStudioContext,
} from './context';
import type { ActivationEvent } from '../analytics/activation';

/**
 * Phase 6 embed bridge — the live postMessage channel between the Tactile World
 * hub (parent) and Studio (embedded iframe).
 *
 * Security model:
 * - Inbound (parent → Studio context) is accepted only from an allowlisted
 *   origin AND, when a `parentOrigin` is known, only from that exact origin.
 * - Outbound (Studio → parent status/completion) is posted ONLY to the
 *   validated `parentOrigin` — never `'*'`. With no allowlisted parent, Studio
 *   still listens but never posts.
 *
 * The transport is abstracted behind {@link BridgeHost} so it is unit-testable
 * without a real iframe.
 */
export interface BridgeHost {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  /** Post to the embedding parent; no-op when not actually embedded. */
  postToParent(message: unknown, targetOrigin: string): void;
}

/** Real-window host: posts to `window.parent` only when embedded. */
export function browserHost(win: Window = window): BridgeHost {
  return {
    addEventListener: (type, listener) => win.addEventListener(type, listener as EventListener),
    removeEventListener: (type, listener) => win.removeEventListener(type, listener as EventListener),
    postToParent: (message, targetOrigin) => {
      if (win.parent && win.parent !== win) win.parent.postMessage(message, targetOrigin);
    },
  };
}

export interface BridgeConfig {
  /** Parent origin from the entry context; validated against the allowlist. */
  parentOrigin?: string;
  allowlist?: readonly string[];
  /** Called with any valid context the parent sends. */
  onContext: (context: TactileStudioContext) => void;
  host?: BridgeHost;
}

export interface StudioBridge {
  /** Handshake: tell the parent Studio is mounted and ready for context. */
  ready(): void;
  /** Workflow step sync (spec §B previewState). */
  postStatus(state: PreviewState): void;
  /** Activation milestone (spec §C — DotPad output success). */
  postActivation(event: ActivationEvent): void;
  /** Completion — parent decides navigation via returnUrl. */
  postComplete(payload?: { returnUrl?: string; assetId?: string }): void;
  /** Whether a validated parent origin exists (outbound messaging possible). */
  readonly canPost: boolean;
  dispose(): void;
}

export function createBridge(config: BridgeConfig): StudioBridge {
  const allowlist = config.allowlist ?? DEFAULT_ALLOWED_ORIGINS;
  const host = config.host ?? browserHost();
  const target = isAllowedOrigin(config.parentOrigin, allowlist) ? config.parentOrigin! : null;

  const listener = (event: MessageEvent) => {
    // Defense in depth: if we know the parent, ignore everything else.
    if (target && event.origin !== target) return;
    const context = parseContextMessage({ origin: event.origin, data: event.data }, allowlist);
    if (context) config.onContext(context);
  };
  host.addEventListener('message', listener);

  const post = (message: Record<string, unknown>): void => {
    if (!target) return; // no allowlisted parent → never post (avoids '*')
    host.postToParent(message, target);
  };

  return {
    canPost: target !== null,
    ready: () => post({ type: 'tactile-studio/ready' }),
    postStatus: (state) => post({ type: 'tactile-studio/status', state }),
    postActivation: (event) => post({ type: 'tactile-studio/activation', event }),
    postComplete: (payload = {}) => post({ type: 'tactile-studio/complete', ...payload }),
    dispose: () => host.removeEventListener('message', listener),
  };
}

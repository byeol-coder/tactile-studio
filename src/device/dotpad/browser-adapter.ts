// src/device/dotpad/browser-adapter.ts
//
// TactileDisplayAdapter implementation for real hardware. This is a THIN
// wrapper around the existing `window.TW.DP` singleton (vendor/tw/dotpad.js)
// — it does not reimplement connection handling, GATT reconnect, or SDK
// framing. Every call delegates to DP; this module only adds:
//   - the target interface shape (connect/disconnect/display/clear/…)
//   - a proper multi-listener fan-out for key events (DP itself only
//     supports one handler at a time via DP.onKey — see the documented
//     limitation below)
//   - deterministic dispose() so a React component can mount/unmount many
//     times without leaking listeners
//
// Per migration principle "do not invent SDK methods": raiseAll/lowerAll are
// wired to `DP.sdk.displayAllUp/displayAllDown`, which we confirmed exist at
// runtime by reading vendor/tw/dotpad-sdk.js directly (see sdk-types.ts and
// docs/known-issues.md #3). DP's own wrapper doesn't expose them, so those
// two calls reach `DP.sdk` directly — every other call goes through DP.

import type {
  TactileDisplayAdapter, PinBuffer, DeviceKeyListener, Unsubscribe,
  ConnectionState, DeviceInfo, StudioDeviceError, DeviceKeyCode,
} from './types.js';
import type { TwDotPadSingleton } from './sdk-types.js';

// DP (vendor/tw/dotpad.js) has exactly one handler slot (`onKey`) shared by
// ALL adapter instances in the page — it has no getter to ask "whose
// dispatcher is currently installed?". We track that ownership here, at
// module scope, so `dispose()` can tell whether ITS dispatcher is the one
// currently installed before clearing it (and leave a different, still-live
// instance's registration alone).
let installedDispatch: ((code: string, extra: string) => void) | null = null;

function toDeviceError(code: StudioDeviceError['code'], message: string, cause?: unknown): StudioDeviceError {
  return { code, message, cause };
}

/**
 * Creates a TactileDisplayAdapter backed by the real `window.TW.DP`
 * singleton. Safe to construct multiple times (e.g. across React remounts);
 * each instance tracks only its OWN key listeners and unsubscribes them on
 * dispose() without touching a different, still-live instance's listeners.
 *
 * KNOWN LIMITATION (documented, not silently papered over): `window.TW.DP`
 * is itself a singleton with a single `_appKeyHandler` slot (see
 * vendor/tw/dotpad.js `onKey(fn)`). This adapter fans that single slot out to
 * multiple listeners via an internal Set, and tracks module-scope ownership
 * of the installed dispatcher so `dispose()` only clears DP's slot when it's
 * this instance's own dispatcher currently installed there — never a
 * different adapter instance's. Concretely: if adapter A and adapter B both
 * subscribe, B's dispatcher ends up installed on DP (last write wins, same
 * as the underlying singleton always did); disposing B correctly hands the
 * slot back to nothing, while disposing A first is a no-op on DP (A never
 * owned the slot at that point) and does not affect B.
 */
export function createBrowserDotPadAdapter(): TactileDisplayAdapter {
  const listeners = new Set<DeviceKeyListener>();
  let connectionState: ConnectionState = 'disconnected';
  let disposed = false;

  function dp(): TwDotPadSingleton | null {
    return (typeof window !== 'undefined' && window.TW && window.TW.DP) || null;
  }

  function dispatch(code: string, extra: string) {
    for (const l of listeners) {
      try { l(code as DeviceKeyCode, extra); } catch { /* one bad listener must not break the others */ }
    }
  }

  function ensureKeyHandlerInstalled() {
    const d = dp();
    if (d) { d.onKey(dispatch); installedDispatch = dispatch; }
  }

  return {
    async connect() {
      const d = dp();
      if (!d || !d.hasReal()) {
        connectionState = 'error';
        throw toDeviceError('not-supported', 'DotPad SDK or Web Bluetooth is not available in this browser.');
      }
      connectionState = 'connecting';
      try {
        const ok = await d.connect();
        connectionState = ok ? 'connected' : 'error';
        if (!ok) throw toDeviceError('connect-failed', 'DotPad connection was not established (device not found or scan cancelled).');
        if (listeners.size) ensureKeyHandlerInstalled();
      } catch (e) {
        connectionState = 'error';
        if ((e as StudioDeviceError)?.code) throw e;
        throw toDeviceError('connect-failed', 'DotPad connection failed.', e);
      }
    },

    async disconnect() {
      const d = dp();
      if (d) { try { await d.disconnect(); } catch { /* DP.disconnect() already swallows its own errors */ } }
      connectionState = 'disconnected';
    },

    async display(buffer: PinBuffer) {
      const d = dp();
      if (!d) throw toDeviceError('not-supported', 'DotPad adapter not available.');
      const ok = await d.output(buffer);
      if (!ok) throw toDeviceError('send-failed', 'Failed to send graphic data to DotPad.');
    },

    async clear() {
      const d = dp();
      if (!d) throw toDeviceError('not-supported', 'DotPad adapter not available.');
      const zeros = '0'.repeat(600); // 60×40 blank page; callers on 96×64 should pass their own buffer via display()
      const ok = await d.output(zeros);
      if (!ok) throw toDeviceError('send-failed', 'Failed to clear DotPad.');
    },

    async raiseAll() {
      const d = dp();
      if (!d || !d.sdk || typeof d.sdk.displayAllUp !== 'function') {
        throw toDeviceError('not-supported', 'displayAllUp is not available on the current SDK/device.');
      }
      d.sdk.displayAllUp(d.device);
    },

    async lowerAll() {
      const d = dp();
      if (!d || !d.sdk || typeof d.sdk.displayAllDown !== 'function') {
        throw toDeviceError('not-supported', 'displayAllDown is not available on the current SDK/device.');
      }
      d.sdk.displayAllDown(d.device);
    },

    subscribeKeys(listener: DeviceKeyListener): Unsubscribe {
      listeners.add(listener);
      ensureKeyHandlerInstalled();
      return () => {
        listeners.delete(listener);
        // Leave DP's handler installed even at zero listeners — reinstalling
        // null/undefined here would race a *different* adapter instance that
        // installed itself afterward. dispose() below tears down the whole
        // instance including its listeners Set.
      };
    },

    getConnectionState() {
      const d = dp();
      if (d && d.isConnected()) return 'connected';
      return connectionState === 'connecting' ? 'connecting' : (d ? 'disconnected' : 'error');
    },

    getDeviceInfo(): DeviceInfo | null {
      const d = dp();
      if (!d || !d.isConnected()) return null;
      return { name: d.deviceName(), cellType: 'unknown', brailleCellCount: d.brailleCellCount() };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      const d = dp();
      // Only release DP's handler slot if OUR dispatcher is the one
      // currently installed — a different, still-live adapter instance may
      // have installed itself after us, and clearing it would silently drop
      // its key events.
      if (d && installedDispatch === dispatch) {
        d.onKey(null);
        installedDispatch = null;
      }
    },
  };
}

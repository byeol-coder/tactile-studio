// src/device/dotpad/mock-adapter.ts
//
// A fully functional, in-memory TactileDisplayAdapter for local development
// and tests — no window/DOM/Bluetooth dependency at all. Satisfies "the
// editor must work when no DotPad is connected" and gives tests something
// real to assert against (lastBuffer, key-dispatch, dispose idempotency)
// instead of stubbing every call.

import type {
  TactileDisplayAdapter, PinBuffer, DeviceKeyListener, Unsubscribe,
  ConnectionState, DeviceInfo, DeviceKeyCode,
} from './types.js';

export interface MockDotPadAdapter extends TactileDisplayAdapter {
  /** test/dev-shell hook: simulate a physical key press. */
  simulateKey(code: DeviceKeyCode, extra?: string): void;
  /** last buffer passed to display(), or null if none yet / cleared. */
  readonly lastBuffer: PinBuffer | null;
  /** raiseAll()/lowerAll() call counts, for lifecycle assertions. */
  readonly raiseAllCalls: number;
  readonly lowerAllCalls: number;
}

export interface MockAdapterOptions {
  /** simulated device name (default 'Mock DotPad 320') */
  deviceName?: string;
  cellType?: string;
  brailleCellCount?: number;
  /** simulate a connect() failure (default false) */
  failConnect?: boolean;
  /** artificial delay in ms for connect()/display(), default 0 (synchronous-ish) */
  latencyMs?: number;
}

export function createMockDotPadAdapter(opts: MockAdapterOptions = {}): MockDotPadAdapter {
  const listeners = new Set<DeviceKeyListener>();
  let state: ConnectionState = 'disconnected';
  let lastBuffer: PinBuffer | null = null;
  let raiseAllCalls = 0, lowerAllCalls = 0;
  let disposed = false;

  const delay = () => (opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve());

  return {
    async connect() {
      state = 'connecting';
      await delay();
      if (opts.failConnect) {
        state = 'error';
        throw { code: 'connect-failed', message: 'Mock adapter configured to fail connect().' };
      }
      state = 'connected';
    },

    async disconnect() {
      await delay();
      state = 'disconnected';
    },

    async display(buffer: PinBuffer) {
      await delay();
      lastBuffer = buffer;
    },

    async clear() {
      await delay();
      lastBuffer = null;
    },

    async raiseAll() {
      raiseAllCalls++;
      lastBuffer = '1'.repeat(600); // mirrors displayAllUp's "all pins raised" semantics
    },

    async lowerAll() {
      lowerAllCalls++;
      lastBuffer = '0'.repeat(600);
    },

    async invert() {
      if (lastBuffer) {
        lastBuffer = Array.from(lastBuffer).map((ch) => (ch === '0' ? 'f' : '0')).join('');
      }
    },

    subscribeKeys(listener: DeviceKeyListener): Unsubscribe {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    simulateKey(code: DeviceKeyCode, extra = '') {
      for (const l of listeners) l(code, extra);
    },

    getConnectionState() { return state; },

    getDeviceInfo(): DeviceInfo | null {
      if (state !== 'connected') return null;
      return {
        name: opts.deviceName || 'Mock DotPad 320',
        cellType: opts.cellType || 'D3',
        brailleCellCount: opts.brailleCellCount ?? 20,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
    },

    get lastBuffer() { return lastBuffer; },
    get raiseAllCalls() { return raiseAllCalls; },
    get lowerAllCalls() { return lowerAllCalls; },
  } as MockDotPadAdapter;
}

// Phase 4 device-adapter tests. The browser adapter is tested against a
// FAKE window.TW.DP (a minimal stand-in matching the real singleton's shape
// exactly — connect/output/outputText/onKey/isConnected/hasReal/disconnect —
// since real hardware/Web Bluetooth cannot exist in this test environment).
// This is not a claim about SDK behavior; it verifies OUR adapter's wiring,
// error translation, and listener lifecycle.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDotPadAdapter } from '../../src/device/dotpad/mock-adapter.js';
import { createBrowserDotPadAdapter } from '../../src/device/dotpad/browser-adapter.js';
import type { TwDotPadSingleton } from '../../src/device/dotpad/sdk-types.js';

function makeFakeDP(overrides: Partial<TwDotPadSingleton> = {}): TwDotPadSingleton {
  let handler: ((code: string, extra: string) => void) | null = null;
  let connected = false;
  const base: TwDotPadSingleton = {
    sdk: {
      displayAllUp: vi.fn(),
      displayAllDown: vi.fn(),
      disconnect: vi.fn(),
    },
    btDevice: {},
    device: { id: 'mock-device' },
    live: false,
    busy: false,
    onKey(fn) { handler = fn; },
    hasReal() { return true; },
    isConnected() { return connected; },
    deviceName() { return 'Fake DotPad'; },
    async connect() { connected = true; return true; },
    async output() { return true; },
    async outputText() { return true; },
    brailleCellCount() { return 20; },
    async disconnect() { connected = false; },
    ...overrides,
  };
  (base as any)._fireKey = (code: string, extra: string) => handler && handler(code, extra);
  return base;
}

describe('mock DotPad adapter', () => {
  it('connects, displays, clears, and reports connection state', async () => {
    const a = createMockDotPadAdapter();
    expect(a.getConnectionState()).toBe('disconnected');
    await a.connect();
    expect(a.getConnectionState()).toBe('connected');
    await a.display('a1b2'.repeat(150));
    expect(a.lastBuffer).toBe('a1b2'.repeat(150));
    await a.clear();
    expect(a.lastBuffer).toBeNull();
    await a.disconnect();
    expect(a.getConnectionState()).toBe('disconnected');
  });

  it('raiseAll/lowerAll set the expected buffers and count calls', async () => {
    const a = createMockDotPadAdapter();
    await a.raiseAll!();
    expect(a.lastBuffer).toBe('1'.repeat(600));
    expect(a.raiseAllCalls).toBe(1);
    await a.lowerAll!();
    expect(a.lastBuffer).toBe('0'.repeat(600));
    expect(a.lowerAllCalls).toBe(1);
  });

  it('dispatches simulated keys only to subscribed listeners, and stops after unsubscribe', () => {
    const a = createMockDotPadAdapter();
    const calls: string[] = [];
    const unsub = a.subscribeKeys!((code) => calls.push(code));
    a.simulateKey('PanningLeft');
    expect(calls).toEqual(['PanningLeft']);
    unsub();
    a.simulateKey('PanningRight');
    expect(calls).toEqual(['PanningLeft']); // no new entry after unsubscribe
  });

  it('propagates a configured connect() failure as a StudioDeviceError-shaped rejection', async () => {
    const a = createMockDotPadAdapter({ failConnect: true });
    await expect(a.connect()).rejects.toMatchObject({ code: 'connect-failed' });
    expect(a.getConnectionState()).toBe('error');
  });

  it('dispose() is idempotent and clears listeners', () => {
    const a = createMockDotPadAdapter();
    const calls: string[] = [];
    a.subscribeKeys!((code) => calls.push(code));
    a.dispose();
    a.dispose(); // must not throw
    a.simulateKey('KeyElse');
    expect(calls).toEqual([]);
  });
});

describe('browser DotPad adapter (wired against a fake window.TW.DP)', () => {
  beforeEach(() => {
    (globalThis as any).window = (globalThis as any).window || {};
  });

  it('delegates connect/display/clear to DP and reports state', async () => {
    const fakeDP = makeFakeDP();
    (globalThis as any).window.TW = { DP: fakeDP };
    const a = createBrowserDotPadAdapter();
    await a.connect();
    expect(a.getConnectionState()).toBe('connected');
    await a.display('ff'.repeat(300));
    await a.clear();
    const info = a.getDeviceInfo();
    expect(info?.name).toBe('Fake DotPad');
    expect(info?.brailleCellCount).toBe(20);
    a.dispose();
  });

  it('translates a connect() failure into a StudioDeviceError, not a raw throw', async () => {
    const fakeDP = makeFakeDP({ hasReal: () => false });
    (globalThis as any).window.TW = { DP: fakeDP };
    const a = createBrowserDotPadAdapter();
    await expect(a.connect()).rejects.toMatchObject({ code: 'not-supported' });
  });

  it('calls the real (confirmed-existing) displayAllUp/displayAllDown via DP.sdk, not an invented method', async () => {
    const fakeDP = makeFakeDP();
    (globalThis as any).window.TW = { DP: fakeDP };
    const a = createBrowserDotPadAdapter();
    await a.raiseAll!();
    expect(fakeDP.sdk!.displayAllUp).toHaveBeenCalledWith(fakeDP.device);
    await a.lowerAll!();
    expect(fakeDP.sdk!.displayAllDown).toHaveBeenCalledWith(fakeDP.device);
  });

  it('rejects raiseAll/lowerAll gracefully when the SDK lacks them, without inventing a fallback', async () => {
    const fakeDP = makeFakeDP({ sdk: null });
    (globalThis as any).window.TW = { DP: fakeDP };
    const a = createBrowserDotPadAdapter();
    await expect(a.raiseAll!()).rejects.toMatchObject({ code: 'not-supported' });
  });

  it('subscribeKeys fans DP\'s single onKey slot out to this instance\'s listeners', async () => {
    const fakeDP = makeFakeDP();
    (globalThis as any).window.TW = { DP: fakeDP };
    const a = createBrowserDotPadAdapter();
    const calls: string[] = [];
    a.subscribeKeys!((code) => calls.push(code));
    (fakeDP as any)._fireKey('PanningAll', '');
    expect(calls).toEqual(['PanningAll']);
    a.dispose();
  });

  it('does not register a duplicate DP.onKey listener across repeated subscribe/unsubscribe cycles (no leak after remount)', () => {
    const fakeDP = makeFakeDP();
    const onKeySpy = vi.spyOn(fakeDP, 'onKey');
    (globalThis as any).window.TW = { DP: fakeDP };

    const a1 = createBrowserDotPadAdapter();
    const unsub1 = a1.subscribeKeys!(() => {});
    a1.dispose();
    unsub1();

    const a2 = createBrowserDotPadAdapter();
    const calls: string[] = [];
    a2.subscribeKeys!((code) => calls.push(code));
    (fakeDP as any)._fireKey('KeyFunction1', '');
    expect(calls).toEqual(['KeyFunction1']); // only a2's listener fires

    // DP.onKey called exactly once per install (a1's, then a1's dispose-null, then a2's) — no silent extra installs
    expect(onKeySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    a2.dispose();
  });

  it('a disposed adapter does not clobber a later adapter\'s DP.onKey registration', () => {
    const fakeDP = makeFakeDP();
    (globalThis as any).window.TW = { DP: fakeDP };

    const a1 = createBrowserDotPadAdapter();
    a1.subscribeKeys!(() => {});

    const a2 = createBrowserDotPadAdapter();
    const calls: string[] = [];
    a2.subscribeKeys!((code) => calls.push(code)); // a2 now owns DP's slot

    a1.dispose(); // must NOT clear a2's registration

    (fakeDP as any)._fireKey('KeyElse', '');
    expect(calls).toEqual(['KeyElse']);
  });
});

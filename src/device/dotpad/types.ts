// src/device/dotpad/types.ts
//
// Device abstraction so React UI and core code never call window.DotPadSDK /
// window.TW.DP directly (Phase 4 target). This is the injected-adapter seam:
// `TactileDisplayAdapter` is what the editor depends on; concrete
// implementations (browser-adapter.ts wrapping the real vendor SDK,
// mock-adapter.ts for dev/tests) are swapped in by the host.

/** Row-major hex string of the shape TW.encodeBits produces (600 chars for
 *  60×40 / dotpad320, 1536 for 96×64 / dotpad768) — the same wire format the
 *  vendor SDK's displayGraphicData expects. Not a new type, just named. */
export type PinBuffer = string;

export type DeviceKeyCode =
  | 'KeyFunction1' | 'KeyFunction2' | 'KeyFunction3' | 'KeyFunction4'
  | 'KeyFunction12' | 'KeyFunction13' | 'KeyFunction14'
  | 'KeyFunction23' | 'KeyFunction24' | 'KeyFunction34'
  | 'KeyElse' | 'PanningAll' | 'PanningLeft' | 'PanningRight' | 'LPF1' | 'RPF4';

export type DeviceKeyListener = (code: DeviceKeyCode, extra: string) => void;
export type Unsubscribe = () => void;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DeviceInfo {
  name: string;
  cellType: string; // 'D2' | 'D3' | 'NONE' — see vendor/tw/dotpad-sdk.js DeviceCellType
  brailleCellCount: number;
}

/** Errors surfaced by an adapter are always this shape — never a raw thrown
 *  value from the SDK — so the UI has one error contract regardless of which
 *  adapter (real hardware, mock) produced it. */
export interface StudioDeviceError {
  code: 'not-supported' | 'connect-failed' | 'send-failed' | 'unknown';
  message: string;
  cause?: unknown;
}

/**
 * The device abstraction. Matches the target interface from the migration
 * spec. `raiseAll`/`lowerAll`/`invert`/`subscribeKeys` are optional because
 * not every adapter (or device generation) supports them — callers must
 * feature-detect, never assume.
 */
export interface TactileDisplayAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  display(buffer: PinBuffer): Promise<void>;
  clear(): Promise<void>;
  raiseAll?(): Promise<void>;
  lowerAll?(): Promise<void>;
  invert?(): Promise<void>;
  subscribeKeys?(listener: DeviceKeyListener): Unsubscribe;
  /** Current connection state, for UI display — not part of the original
   *  minimal interface sketch, but required to avoid the UI polling the SDK
   *  singleton directly (which would violate the "never call the SDK
   *  directly" rule). */
  getConnectionState(): ConnectionState;
  getDeviceInfo(): DeviceInfo | null;
  /** Deterministic teardown: removes every listener/subscription this
   *  adapter instance registered. Must be idempotent and safe to call even
   *  if never connected. */
  dispose(): void;
}

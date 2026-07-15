// src/device/dotpad/sdk-types.ts
//
// Minimal ambient types for the globals the vendored SDK exposes, derived
// directly by reading vendor/tw/dotpad-sdk.js and vendor/tw/dotpad.js (not
// invented, not copied from any official .d.ts — none ships with the SDK).
// Only the members our adapter actually calls are typed; anything else on
// these objects is intentionally left untyped so we're never tempted to call
// a method we haven't verified exists.
//
// CONFIRMED BY DIRECT SOURCE INSPECTION (see docs/known-issues.md #3):
// `DotPadSDK.prototype.displayAllUp` and `.displayAllDown` DO exist at
// runtime in this vendored build (v3.0.0) — they iterate connected devices
// and call `displayTextData('FF'.repeat(...))` / `displayGraphicData(...)`.
// The app-level wrapper (vendor/tw/dotpad.js, `window.TW.DP`) does not
// currently expose them, so our adapter calls `DP.sdk` directly for these
// two methods only — every other interaction goes through `DP`.

// CONFIRMED BY DIRECT SOURCE INSPECTION (vendor/tw/dotpad.js): `gattOk()`
// (`!!(this.btDevice && this.btDevice.gatt && this.btDevice.gatt.connected)`,
// swallowed to false on any error) and `ensure(force)` (reconnects to the
// ALREADY-PAIRED btDevice via `sdk.connectBleDevice(this.btDevice)` when the
// GATT link is down, or immediately returns true if force is falsy and the
// link is already up) both exist at runtime on the DP singleton. Used by the
// background health-watch in browser-adapter.ts — see its doc comment.

export type DotPadDeviceHandle = unknown; // opaque `DotDevice` instance

export interface DotPadSDKInstance {
  displayAllUp(device?: DotPadDeviceHandle | null): void;
  displayAllDown(device?: DotPadDeviceHandle | null): void;
  disconnect(device?: DotPadDeviceHandle | null): void;
}

/** The app-level singleton wrapper (vendor/tw/dotpad.js). This is what our
 *  browser adapter delegates to for everything except raiseAll/lowerAll. */
export interface TwDotPadSingleton {
  sdk: DotPadSDKInstance | null;
  btDevice: unknown;
  device: DotPadDeviceHandle | null;
  live: boolean;
  busy: boolean;
  onKey(fn: ((code: string, extra: string) => void) | null): void;
  hasReal(): boolean;
  isConnected(): boolean;
  /** True iff the underlying Web Bluetooth GATT link is currently physically
   *  connected — narrower than isConnected() (which also requires `live`).
   *  Never throws (swallows to false internally). */
  gattOk(): boolean;
  /** Reconnects to the already-paired btDevice if the GATT link is down (or
   *  immediately returns true without reconnecting if `force` is falsy and
   *  the link is already up). Unlike connect(), does NOT open a new device
   *  picker — safe to call unattended (e.g. from a timer), no user gesture
   *  required. Resolves false if reconnection fails. */
  ensure(force?: boolean): Promise<boolean>;
  deviceName(): string;
  connect(): Promise<boolean>;
  output(hex: string): Promise<boolean>;
  outputText(hex: string): Promise<boolean>;
  brailleCellCount(): number;
  disconnect(): Promise<void>;
}

declare global {
  interface Window {
    TW?: { DP?: TwDotPadSingleton };
  }
}

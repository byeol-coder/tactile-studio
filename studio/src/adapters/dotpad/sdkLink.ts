import { DataCodes, DisplayMode, DotPadSDK, DotPadScanner, type DotPadSdkDevice } from './sdk/DotPadSDK-3_0_0.js';
import type { DeviceEvents, DeviceHandle, EncodedFrame } from '../types';

export type DotPadTransport = 'auto' | 'ble' | 'usb';

interface BrowserSupport {
  isBrowser: boolean;
  secureContext: boolean;
  ble: boolean;
  usb: boolean;
}

const SDK_CONNECT_WAIT_MS = 3500;

function getGlobalLocation(): Location | null {
  return typeof window === 'undefined' ? null : window.location;
}

function isLocalhost(location: Location | null): boolean {
  if (!location) return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

export function getDotPadBrowserSupport(): BrowserSupport {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const location = getGlobalLocation();
  return {
    isBrowser: nav !== null,
    secureContext: typeof window !== 'undefined' && (window.isSecureContext || isLocalhost(location)),
    ble: Boolean(nav?.bluetooth),
    usb: Boolean(nav?.serial),
  };
}

export function isDotPadTransportSupported(transport: DotPadTransport): boolean {
  const support = getDotPadBrowserSupport();
  if (!support.isBrowser || !support.secureContext) return false;
  if (transport === 'ble') return support.ble;
  if (transport === 'usb') return support.usb;
  return support.ble || support.usb;
}

export function describeDotPadSupport(): string {
  const support = getDotPadBrowserSupport();
  if (!support.isBrowser) return 'DotPad mock (non-browser runtime)';
  if (!support.secureContext) return 'DotPad mock (requires HTTPS or localhost)';
  if (!support.ble && !support.usb) return 'DotPad mock (Web Bluetooth/Web Serial unavailable)';
  return 'DotPad SDK ready';
}

function selectTransport(requested: DotPadTransport): Exclude<DotPadTransport, 'auto'> {
  if (requested !== 'auto') return requested;
  const support = getDotPadBrowserSupport();
  return support.ble ? 'ble' : 'usb';
}

function waitForConnected(signal: Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve();
    }, SDK_CONNECT_WAIT_MS);
    signal
      .then(() => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve();
      })
      .catch(() => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve();
      });
  });
}

class SdkDotPadHandle implements DeviceHandle {
  readonly name: string;
  private connected = true;

  constructor(
    name: string,
    private readonly sdk: DotPadSDK,
    private readonly device: DotPadSdkDevice,
    private readonly events?: DeviceEvents,
  ) {
    this.name = name;
  }

  async send(frame: EncodedFrame): Promise<void> {
    if (!this.connected) throw new Error('DotPad not connected');
    this.sdk.displayGraphicData(frame.hex, this.device, DisplayMode.GraphicMode);
  }

  async sendDiff(_prev: EncodedFrame | null, next: EncodedFrame): Promise<void> {
    await this.send(next);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.sdk.disconnect(this.device);
    this.events?.onStatus?.('disconnected');
  }

  markDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    this.events?.onStatus?.('disconnected');
  }
}

export async function connectDotPadSdkLink(
  requestedTransport: DotPadTransport,
  events?: DeviceEvents,
): Promise<DeviceHandle> {
  const support = getDotPadBrowserSupport();
  if (!support.isBrowser || !support.secureContext) {
    throw new Error('DotPad SDK requires a Chromium browser on HTTPS or localhost.');
  }
  if (!isDotPadTransportSupported(requestedTransport)) {
    throw new Error('This browser does not expose Web Bluetooth or Web Serial for DotPad.');
  }

  const transport = selectTransport(requestedTransport);
  const sdk = new DotPadSDK();
  const scanner = new DotPadScanner();
  let deviceName = transport === 'ble' ? 'DotPad BLE' : 'DotPad USB';
  let connectedDevice: DotPadSdkDevice | null = null;
  let activeHandle: SdkDotPadHandle | null = null;
  let connectedResolve: (() => void) | null = null;
  const connectedSignal = new Promise<void>((resolve) => {
    connectedResolve = resolve;
  });

  sdk.setCallBack((device, code, data) => {
    if (code === DataCodes.DeviceName && data) deviceName = data;
    if (code === DataCodes.Connected) {
      connectedDevice = device;
      connectedResolve?.();
      return;
    }
    if (code === DataCodes.Disconnected) {
      activeHandle?.markDisconnected();
      return;
    }
    if (code === DataCodes.ConnectedFail || code === DataCodes.CommandError) {
      events?.onStatus?.('error', data);
    }
  }, null);

  const nativeDevice =
    transport === 'ble' ? await scanner.startBleScan() : await scanner.startUsbScan();
  if (!nativeDevice) throw new Error(`No DotPad ${transport.toUpperCase()} device selected.`);

  if ('name' in nativeDevice && nativeDevice.name) deviceName = nativeDevice.name;

  const sdkDevice =
    transport === 'ble'
      ? await sdk.connectBleDevice(nativeDevice as BluetoothDevice)
      : await sdk.connectUsbDevice(nativeDevice as SerialPort);
  if (!sdkDevice) throw new Error(`DotPad ${transport.toUpperCase()} connection failed.`);

  connectedDevice = connectedDevice ?? sdkDevice;
  await waitForConnected(connectedSignal);

  activeHandle = new SdkDotPadHandle(deviceName, sdk, connectedDevice, events);
  return activeHandle;
}

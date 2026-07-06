import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncodedFrame } from '../../types';
import type { TactileFrame } from '../../../model/frame';
import { connectDotPadSdkLink } from '../sdkLink';

const sdkMock = vi.hoisted(() => ({
  displayGraphicData: vi.fn(),
  disconnect: vi.fn(),
  messageCallback: null as null | ((device: { connectDevice?: { name?: string } }, code: string, data: string) => void),
}));

vi.mock('../sdk/DotPadSDK-3_0_0.js', () => ({
  DataCodes: {
    Connected: 'Connected',
    ConnectedFail: 'ConnectedFail',
    Disconnected: 'Disconnected',
    DeviceName: 'DeviceName',
    CommandError: 'CommandError',
  },
  DisplayMode: { GraphicMode: 'GraphicMode', TextMode: 'TextMode' },
  DotPadScanner: class {
    async startBleScan() {
      return { name: 'DotPad BLE Test' };
    }
    async startUsbScan() {
      return {
        open: vi.fn(),
        close: vi.fn(),
      };
    }
  },
  DotPadSDK: class {
    setCallBack(
      messageCallback: (device: { connectDevice?: { name?: string } }, code: string, data: string) => void,
    ) {
      sdkMock.messageCallback = messageCallback;
    }
    async connectBleDevice(device: { name?: string }) {
      const sdkDevice = { connectDevice: device };
      sdkMock.messageCallback?.(sdkDevice, 'DeviceName', 'DotPad SDK Test');
      sdkMock.messageCallback?.(sdkDevice, 'Connected', '');
      return sdkDevice;
    }
    async connectUsbDevice(port: unknown) {
      const sdkDevice = { connectDevice: port as { name?: string } };
      sdkMock.messageCallback?.(sdkDevice, 'Connected', '');
      return sdkDevice;
    }
    displayGraphicData = sdkMock.displayGraphicData;
    disconnect = sdkMock.disconnect;
  },
}));

function encodedFrame(hex: string): EncodedFrame {
  const frame: TactileFrame = {
    resolution: '60x40',
    width: 60,
    height: 40,
    bitmap: new Uint8Array(60 * 40),
  };
  return { resolution: '60x40', hex, bytes: new Uint8Array([0xa5]), frame };
}

describe('DotPad SDK link', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      location: { hostname: 'localhost' },
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal('navigator', { bluetooth: {}, serial: {} });
    sdkMock.displayGraphicData.mockClear();
    sdkMock.disconnect.mockClear();
    sdkMock.messageCallback = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a BLE SDK session and sends frameToHex output through displayGraphicData', async () => {
    const handle = await connectDotPadSdkLink('ble');

    await handle.send(encodedFrame('A5'));

    expect(handle.name).toBe('DotPad SDK Test');
    expect(sdkMock.displayGraphicData).toHaveBeenCalledWith(
      'A5',
      expect.objectContaining({ connectDevice: { name: 'DotPad BLE Test' } }),
      'GraphicMode',
    );
  });

  it('disconnects the active SDK device', async () => {
    const events: string[] = [];
    const handle = await connectDotPadSdkLink('ble', { onStatus: (status) => events.push(status) });

    await handle.disconnect();

    expect(sdkMock.disconnect).toHaveBeenCalledOnce();
    expect(events).toEqual(['disconnected']);
  });
});

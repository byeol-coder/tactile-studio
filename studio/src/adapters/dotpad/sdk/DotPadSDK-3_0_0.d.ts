export const DataCodes: {
  readonly Connected: 'Connected';
  readonly ConnectedFail: 'ConnectedFail';
  readonly Disconnected: 'Disconnected';
  readonly DeviceName: 'DeviceName';
  readonly CommandError: 'CommandError';
};

export const DisplayMode: {
  readonly GraphicMode: 'GraphicMode';
  readonly TextMode: 'TextMode';
};

export interface DotPadSdkDevice {
  readonly connectDevice?: { readonly name?: string };
  readonly isConnect?: boolean;
}

export class DotPadScanner {
  startBleScan(): Promise<BluetoothDevice | undefined>;
  startUsbScan(): Promise<SerialPort | undefined>;
}

export class DotPadSDK {
  setCallBack(
    messageCallBack: ((device: DotPadSdkDevice, code: string, data: string) => void) | null,
    keyCallBack: ((device: DotPadSdkDevice, code: string, data: string) => void) | null,
  ): void;
  connectBleDevice(device: BluetoothDevice): Promise<DotPadSdkDevice | null>;
  connectUsbDevice(port: SerialPort): Promise<DotPadSdkDevice | null>;
  disconnect(device?: DotPadSdkDevice | null): void;
  displayGraphicData(hex: string, device?: DotPadSdkDevice | null, mode?: string): void;
  displayTextData(text: string, device?: DotPadSdkDevice | null, mode?: string): void;
}

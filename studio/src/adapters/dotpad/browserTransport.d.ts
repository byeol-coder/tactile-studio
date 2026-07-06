interface BluetoothDevice {
  readonly name?: string;
}

interface BluetoothRequestDeviceOptions {
  filters?: Array<{ namePrefix?: string; services?: string[] }>;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

interface SerialPort {
  readonly readable?: ReadableStream<Uint8Array>;
  readonly writable?: WritableStream<Uint8Array>;
  open(options: { baudRate: number; dataBits?: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  requestPort(options?: { filters?: Array<{ usbVendorId: number; usbProductId?: number }> }): Promise<SerialPort>;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
  readonly serial?: Serial;
}

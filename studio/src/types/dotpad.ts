/** Connection lifecycle for the DotPad device (mocked in v0). */
export type DotPadStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Lifecycle of the tactile send operation. */
export type SendStatus = 'idle' | 'ready' | 'sending' | 'sent' | 'error';

export interface DotPadDevice {
  /** Human-readable device name, e.g. "DotPad-320". */
  name: string;
  /** Native resolution the device renders at. */
  resolution: '60x40';
}

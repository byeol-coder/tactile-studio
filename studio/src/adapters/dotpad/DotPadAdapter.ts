import type { TactileDocument, TactileResolution } from '../../types/tactile';
import { docToFrame, frameToHex } from '../../model/frame';
import type { DeviceAdapter, DeviceConnectOptions, DeviceEvents, DeviceHandle, EncodedFrame } from '../types';
import { connectDotPadSdkLink, describeDotPadSupport, isDotPadTransportSupported } from './sdkLink';

/** Convert a HEX string to its backing byte array. */
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
  }
  return out;
}

/**
 * Build a real `.dtms` container (JSON) matching the vanilla app's
 * `buildDtmsJSON` output so files round-trip through the existing `parseDtms`
 * and load on real hardware. Single-page for v0.
 */
export function buildDtmsContainer(doc: TactileDocument): string {
  const title = (doc.title || 'Untitled').trim();
  const hex = frameToHex(docToFrame(doc));
  return JSON.stringify(
    {
      title,
      lang: 'korean',
      lang_option: '1',
      device: 'dotpad320',
      audioPath: '',
      items: [
        {
          page: 1,
          title,
          graphic: { name: '1.dtm', data: hex },
          text: { name: '1.txt', data: '', plain: title },
          audio: { fileName: '' },
        },
      ],
    },
    null,
    2,
  );
}

/**
 * Mock fallback used only when the browser cannot expose real DotPad I/O.
 * Encoding and send/diff surfaces stay identical to the SDK-backed handle.
 */
class MockDotPadHandle implements DeviceHandle {
  constructor(
    readonly name: string,
    private readonly adapter: DotPadAdapter,
    private readonly events?: DeviceEvents,
  ) {}

  async send(frame: EncodedFrame): Promise<void> {
    // Simulate a full-frame write in unsupported browsers/test environments.
    void frame;
    await this.tick();
  }

  async sendDiff(prev: EncodedFrame | null, next: EncodedFrame): Promise<void> {
    const changed = this.adapter.diff(prev, next);
    // Keep the diff surface exercised even when the SDK path is unavailable.
    void changed;
    await this.tick();
  }

  async disconnect(): Promise<void> {
    this.events?.onStatus?.('disconnected');
  }

  private tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 40));
  }
}

/** DotPad refreshable-display adapter. Encoding is pure; transport uses DotPadSDK when available. */
export class DotPadAdapter implements DeviceAdapter {
  readonly id = 'dotpad';
  readonly label = 'DotPad';
  readonly resolutions: readonly TactileResolution[] = ['60x40'];

  supports(resolution: TactileResolution): boolean {
    return this.resolutions.includes(resolution);
  }

  encode(doc: TactileDocument): EncodedFrame {
    const frame = docToFrame(doc);
    const hex = frameToHex(frame);
    return { resolution: doc.resolution, hex, bytes: hexToBytes(hex), frame };
  }

  /** Flat cell indices (`y*width+x`) whose raised/lowered state changed. */
  diff(prev: EncodedFrame | null, next: EncodedFrame): number[] {
    const nb = next.frame.bitmap;
    if (!prev || prev.frame.bitmap.length !== nb.length) {
      const all: number[] = [];
      for (let i = 0; i < nb.length; i++) all.push(i);
      return all;
    }
    const pb = prev.frame.bitmap;
    const changed: number[] = [];
    for (let i = 0; i < nb.length; i++) {
      if (pb[i] !== nb[i]) changed.push(i);
    }
    return changed;
  }

  async connect(events?: DeviceEvents, options: DeviceConnectOptions = {}): Promise<DeviceHandle> {
    const transport = options.transport ?? 'auto';
    events?.onStatus?.('connecting');
    if (isDotPadTransportSupported(transport)) {
      const handle = await connectDotPadSdkLink(transport, events);
      events?.onStatus?.('connected', handle.name);
      return handle;
    }

    const fallbackName = describeDotPadSupport();
    await new Promise((resolve) => setTimeout(resolve, 80));
    events?.onStatus?.('connected', fallbackName);
    return new MockDotPadHandle(fallbackName, this, events);
  }
}

export const dotPadAdapter = new DotPadAdapter();

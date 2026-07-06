import type { TactileDocument, TactileResolution } from '../../types/tactile';
import { docToFrame, frameToHex } from '../../model/frame';
import type { DeviceAdapter, DeviceEvents, DeviceHandle, EncodedFrame } from '../types';

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
 * Mock BLE handle used in v0. It exercises the full send/diff surface so the UI
 * and streaming logic are built against the real interface; swapping in the
 * DotPadSDK-3.0.0 transport later means replacing only `connect()`.
 */
class MockDotPadHandle implements DeviceHandle {
  constructor(
    readonly name: string,
    private readonly adapter: DotPadAdapter,
    private readonly events?: DeviceEvents,
  ) {}

  async send(frame: EncodedFrame): Promise<void> {
    // Simulate a full-frame write; a real transport would push `frame.bytes`.
    void frame;
    await this.tick();
  }

  async sendDiff(prev: EncodedFrame | null, next: EncodedFrame): Promise<void> {
    const changed = this.adapter.diff(prev, next);
    // A real transport would address only `changed` cells; here we just settle.
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

/** DotPad refreshable-display adapter. Encoding real; transport mocked in v0. */
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

  async connect(events?: DeviceEvents): Promise<DeviceHandle> {
    events?.onStatus?.('connecting');
    await new Promise((resolve) => setTimeout(resolve, 250));
    events?.onStatus?.('connected', 'DotPad-320 (mock)');
    return new MockDotPadHandle('DotPad-320 (mock)', this, events);
  }
}

export const dotPadAdapter = new DotPadAdapter();

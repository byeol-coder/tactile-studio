import type { TactileResolution } from '../types/tactile';
import type { DeviceAdapter, OutputAdapter, PreviewRenderer } from './types';
import { dotPadAdapter } from './dotpad/DotPadAdapter';
import { embossAdapter } from './emboss/EmbossAdapter';
import { canvasPreviewRenderer } from './preview/CanvasPreviewRenderer';

/**
 * Adapter registry — the one place output targets are wired in.
 *
 * "Adding a new printer = writing one new adapter" (build spec §4): implement
 * {@link DeviceAdapter} or {@link OutputAdapter}, then register it here. Nothing
 * else in the editor changes.
 */
const deviceAdapters: DeviceAdapter[] = [dotPadAdapter];
const outputAdapters: OutputAdapter[] = [embossAdapter];
const previewRenderers: PreviewRenderer[] = [canvasPreviewRenderer];

export function getDeviceAdapters(): readonly DeviceAdapter[] {
  return deviceAdapters;
}

export function getOutputAdapters(): readonly OutputAdapter[] {
  return outputAdapters;
}

/** First device adapter that supports the given resolution, if any. */
export function getDeviceAdapterFor(resolution: TactileResolution): DeviceAdapter | undefined {
  return deviceAdapters.find((a) => a.supports(resolution));
}

export function getDeviceAdapter(id: string): DeviceAdapter | undefined {
  return deviceAdapters.find((a) => a.id === id);
}

export function getOutputAdapter(id: string): OutputAdapter | undefined {
  return outputAdapters.find((a) => a.id === id);
}

export function getPreviewRenderer(id = 'canvas-preview'): PreviewRenderer | undefined {
  return previewRenderers.find((r) => r.id === id);
}

/** Register a device adapter at runtime (e.g. a plugin). */
export function registerDeviceAdapter(adapter: DeviceAdapter): void {
  if (!deviceAdapters.some((a) => a.id === adapter.id)) deviceAdapters.push(adapter);
}

/** Register an output adapter at runtime. */
export function registerOutputAdapter(adapter: OutputAdapter): void {
  if (!outputAdapters.some((a) => a.id === adapter.id)) outputAdapters.push(adapter);
}

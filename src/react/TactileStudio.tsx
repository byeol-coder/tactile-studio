// Host-friendly public entry point for Tactile Worlds. It deliberately maps
// the product-facing adapter names onto the richer editor services object;
// no router, iframe, authentication, or Supabase dependency leaks into Studio.

import React from 'react';
import { TactileStudioEditor } from './TactileStudioEditor.js';
import type { TactileStudioEditorProps, StudioServices } from './types/public-api.js';
import type { StudioStorageAdapter } from '../storage/adapters/types.js';
import type { TactileDisplayAdapter } from '../device/dotpad/types.js';

export interface TactileStudioProps extends Omit<TactileStudioEditorProps, 'services'> {
  /** Host locale marker. Labels remain host-owned, so Studio never switches
   *  language internally; this is exposed for styling/analytics only. */
  locale?: string;
  storageAdapter: StudioStorageAdapter;
  deviceAdapter?: TactileDisplayAdapter;
  /** Optional host services beyond storage/device (braille, image conversion,
   *  DTMS encoding, corpus). Adapter ownership stays with the host. */
  services?: Omit<StudioServices, 'storage' | 'tactileDisplay'>;
}

export function TactileStudio({ locale, storageAdapter, deviceAdapter, services, ...props }: TactileStudioProps) {
  return (
    <div data-tactile-studio-locale={locale}>
      <TactileStudioEditor
        {...props}
        services={{ ...services, storage: storageAdapter, tactileDisplay: deviceAdapter }}
      />
    </div>
  );
}

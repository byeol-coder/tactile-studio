// src/react/hooks/useHardwareKeyPanning.ts
//
// Verbatim port of the monolith's DotPad hardware-key page panning
// (componentDidMount's `window.TW.DP.onKey` block): the physical
// PanningLeft/PanningRight arrow keys on the device move to the
// previous/next DOCUMENT page — exactly EditorStore.setActivePage, nothing
// more (the monolith doesn't do anything with PanningAll or the function
// keys here; if a future UI wants those, extend this hook explicitly rather
// than silently guessing at behavior that was never specified).
//
// Subscribed once per adapter, regardless of connection state — the
// subscription itself is inert until real hardware sends key events, same
// as the monolith registering `DP.onKey` unconditionally in
// componentDidMount rather than waiting for a connection.

import { useEffect, useRef } from 'react';
import { useEditorStore } from './useEditorStore.js';
import type { TactileDisplayAdapter, DeviceKeyCode } from '../../device/dotpad/types.js';

export function useHardwareKeyPanning(adapter: TactileDisplayAdapter | undefined) {
  const { snapshot, store } = useEditorStore();
  const pageIndexRef = useRef(snapshot.pageIndex);
  pageIndexRef.current = snapshot.pageIndex;

  useEffect(() => {
    if (!adapter?.subscribeKeys) return;
    const unsubscribe = adapter.subscribeKeys((code: DeviceKeyCode) => {
      if (code === 'PanningLeft') store.setActivePage(pageIndexRef.current - 1);
      else if (code === 'PanningRight') store.setActivePage(pageIndexRef.current + 1);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, store]);
}

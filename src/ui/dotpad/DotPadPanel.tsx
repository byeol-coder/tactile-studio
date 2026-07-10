// src/ui/dotpad/DotPadPanel.tsx
//
// Wired to a TactileDisplayAdapter (Phase 4) via services.tactileDisplay —
// works identically with the browser adapter or the mock adapter, and
// renders nothing (returns null) if the host didn't provide one, since a
// DotPad is optional hardware. DEFERRED (documented): live-preview toggle,
// test-pattern button, raiseAll/lowerAll controls, hardware key-driven
// panning (subscribeKeys is wired for future use but no UI consumes it yet).

import React, { useEffect, useState, useCallback } from 'react';
import type { TactileDisplayAdapter, ConnectionState } from '../../device/dotpad/types.js';
import { encodeDtmsHex, type TwEncodeBits } from '../../codecs/dtms/dtms.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface DotPadPanelProps {
  adapter: TactileDisplayAdapter;
  encodeBits?: TwEncodeBits;
  labels?: StudioLabels;
}

export function DotPadPanel({ adapter, encodeBits, labels }: DotPadPanelProps) {
  const { snapshot, store } = useEditorStore();
  const [state, setState] = useState<ConnectionState>(adapter.getConnectionState());
  const [error, setError] = useState<string | null>(null);

  // Poll connection state — the adapter has no onConnectionStateChange event
  // in this pass (Phase 4 scope), so we refresh after every user-initiated
  // action rather than subscribing to something that doesn't exist yet.
  const refresh = useCallback(() => setState(adapter.getConnectionState()), [adapter]);

  useEffect(() => () => { adapter.dispose(); }, [adapter]);

  const connect = async () => {
    setError(null);
    try { await adapter.connect(); } catch (e: any) { setError(e?.message || 'Connection failed'); }
    refresh();
  };
  const disconnect = async () => { await adapter.disconnect(); refresh(); };

  const send = async () => {
    if (!encodeBits) return;
    setError(null);
    try {
      const hex = encodeDtmsHex(encodeBits, store.getActiveCells(), snapshot.gridW, snapshot.gridH);
      await adapter.display(hex);
    } catch (e: any) {
      setError(e?.message || 'Send failed');
    }
  };

  const connected = state === 'connected';
  const info = connected ? adapter.getDeviceInfo() : null;

  return (
    <div role="region" aria-label={(labels?.dpPanelTitle as string) || 'DotPad Output'} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{(labels?.dpPanelTitle as string) || 'DotPad Output'}</div>
      <div aria-live="polite" style={{ fontSize: 12 }}>
        {connected ? `${info?.name ?? 'DotPad'} — connected` : state === 'connecting' ? 'Connecting…' : 'Not connected'}
      </div>
      {!connected ? (
        <button type="button" onClick={connect}>Connect</button>
      ) : (
        <>
          <button type="button" onClick={disconnect}>Disconnect</button>
          <button type="button" onClick={send} disabled={!encodeBits}>Send current page</button>
        </>
      )}
      {error && <div role="alert" style={{ color: 'var(--ts-danger, #DA120D)', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

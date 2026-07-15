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
import type { StudioLabels, StudioErrorLike } from '../../react/types/public-api.js';

export interface DotPadPanelProps {
  adapter: TactileDisplayAdapter;
  encodeBits?: TwEncodeBits;
  labels?: StudioLabels;
  /** Also reported to the host's top-level onError, in addition to the
   *  inline error text below (which stays regardless, for sighted users
   *  looking at the panel itself). */
  onError?(error: StudioErrorLike): void;
}

export function DotPadPanel({ adapter, encodeBits, labels, onError }: DotPadPanelProps) {
  const { snapshot, store } = useEditorStore();
  const [state, setState] = useState<ConnectionState>(adapter.getConnectionState());
  const [error, setError] = useState<string | null>(null);

  // Refresh after every user-initiated action (works with any adapter, even
  // ones without background events). Additionally subscribe to
  // onConnectionStateChange when the adapter supports it (e.g. the browser
  // adapter's background health-watch, ported from the monolith's
  // _connWatch — see browser-adapter.ts) so a silent drop/reconnect that
  // happens WITHOUT a user action still reaches the UI promptly, closing
  // the gap the previous version of this comment documented.
  const refresh = useCallback(() => setState(adapter.getConnectionState()), [adapter]);

  useEffect(() => {
    const unsub = adapter.onConnectionStateChange?.((s) => setState(s));
    return () => { unsub?.(); adapter.dispose(); };
  }, [adapter]);

  const connect = async () => {
    setError(null);
    try {
      await adapter.connect();
    } catch (e: any) {
      setError(e?.message || 'Connection failed');
      onError?.({ code: e?.code || 'connect-failed', message: e?.message || 'Connection failed', cause: e });
    }
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
      onError?.({ code: e?.code || 'send-failed', message: e?.message || 'Send failed', cause: e });
    }
  };

  const connected = state === 'connected';
  const info = connected ? adapter.getDeviceInfo() : null;
  const statusText = connected
    ? `${info?.name ?? 'DotPad'} — connected`
    : state === 'connecting' ? ((labels?.dpStateConnecting as string) || 'Connecting…')
    : state === 'reconnecting' ? ((labels?.dpStateReconnecting as string) || 'Reconnecting…')
    : (labels?.dpStateDisconnected as string) || 'Not connected';

  return (
    <div role="region" aria-label={(labels?.dpPanelTitle as string) || 'DotPad Output'} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{(labels?.dpPanelTitle as string) || 'DotPad Output'}</div>
      <div aria-live="polite" style={{ fontSize: 12 }}>
        {statusText}
      </div>
      {!connected ? (
        <button type="button" onClick={connect} disabled={state === 'connecting' || state === 'reconnecting'}>Connect</button>
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

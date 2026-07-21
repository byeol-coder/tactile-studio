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
import { ConfirmDialog } from '../dialogs/ConfirmDialog.js';

// A4 braille-paper grid, matching vanilla's OUTPUTS table exactly
// (index.html: { key: 'a4', gw: 84, gh: 118, label: 'A4' }) — an embossing-only
// format, never a real DotPad hardware resolution (60x40 / 96x64).
const A4_GRID_W = 84;
const A4_GRID_H = 118;

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
  const [busy, setBusy] = useState(false);

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

  const [showA4Warning, setShowA4Warning] = useState(false);
  const isA4Grid = snapshot.gridW === A4_GRID_W && snapshot.gridH === A4_GRID_H;

  const send = async () => {
    if (!encodeBits) return;
    if (isA4Grid) { setShowA4Warning(true); return; }
    setError(null);
    try {
      const hex = encodeDtmsHex(encodeBits, store.getActiveCells(), snapshot.gridW, snapshot.gridH);
      await adapter.display(hex);
      // Success feedback — same pairing convention as the rest of the store
      // (Toolbar.tsx, useKeyboardShortcuts.ts): toastMsg for the sighted-user
      // pill, announce for the screen-reader live region, fired together.
      // Matches the monolith's "6b. Send success" screen intent (see vanilla
      // index.html's data-screen-label="6b. Send success"), just realized as
      // a toast/announce pair here rather than a dedicated screen.
      const successMsg = (labels?.dpSendSuccess as string) || 'Sent to DotPad.';
      store.toastMsg(successMsg);
      store.announce(successMsg);
    } catch (e: any) {
      setError(e?.message || 'Send failed');
      onError?.({ code: e?.code || 'send-failed', message: e?.message || 'Send failed', cause: e });
    }
  };
  const deviceTest = async (kind: 'raise' | 'lower' | 'invert') => {
    if (busy) return;
    if (kind === 'invert' && isA4Grid && encodeBits) { setShowA4Warning(true); return; }
    setBusy(true); setError(null);
    try {
      if (kind === 'raise') await adapter.raiseAll?.();
      else if (kind === 'lower') await adapter.lowerAll?.();
      else if (encodeBits) {
        const hex = encodeDtmsHex(encodeBits, store.getActiveCells(), snapshot.gridW, snapshot.gridH);
        await adapter.display(hex.replace(/../g, (pair) => (255 ^ parseInt(pair, 16)).toString(16).padStart(2, '0')));
      } else if (adapter.invert) await adapter.invert();
      else throw new Error('This device does not support that test.');
      store.announce(`Device test completed: ${kind}.`);
    } catch (e: any) { setError(e?.message || 'Device test failed'); }
    finally { setBusy(false); refresh(); }
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
          {(adapter.raiseAll || adapter.lowerAll || adapter.invert || encodeBits) && <div style={{ borderTop: '1px solid var(--ts-line, #ECE6DC)', paddingTop: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Device tests</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {adapter.raiseAll && <button type="button" disabled={busy} onClick={() => deviceTest('raise')}>Raise all</button>}
              {adapter.lowerAll && <button type="button" disabled={busy} onClick={() => deviceTest('lower')}>Lower all</button>}
              {(adapter.invert || encodeBits) && <button type="button" disabled={busy} onClick={() => deviceTest('invert')}>Invert</button>}
            </div>
          </div>}
        </>
      )}
      {error && <div role="alert" style={{ color: 'var(--ts-danger, #DA120D)', fontSize: 12 }}>{error}</div>}
      <ConfirmDialog
        open={showA4Warning}
        title={(labels?.dpA4IncompatTitle as string) || 'This format can\u2019t be sent to DotPad'}
        message={(labels?.dpA4IncompatSub as string) || 'A4 braille-paper documents can be converted to a DotPad grid before sending, or exported for embossing.'}
        confirmLabel={(labels?.dpA4IncompatConfirm as string) || 'OK'}
        onConfirm={() => setShowA4Warning(false)}
      />
    </div>
  );
}

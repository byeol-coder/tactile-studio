import { useCallback } from 'react';
import { useAppStore } from '../app/appState';
import * as dotPadSession from '../adapters/dotpad/session';
import type { DeviceEvents } from '../adapters/types';

/**
 * DotPad connection hook.
 *
 * Drives {@link dotPadSession} (which owns the DotPadAdapter handle) and lets
 * the adapter's `onStatus` events set the UI connection state — no duplicated
 * mock timers here. The transport is still mocked in v0; Phase 3 replaces only
 * the adapter's `connect()`, leaving this hook's contract
 * (disconnected → connecting → connected | error) intact.
 */
export function useDotPadConnection() {
  const { state, dispatch } = useAppStore();

  const connect = useCallback(() => {
    const events: DeviceEvents = {
      onStatus: (status, detail) => {
        switch (status) {
          case 'connecting':
            dispatch({ type: 'dotpad/status', status: 'connecting' });
            break;
          case 'connected':
            dispatch({ type: 'dotpad/status', status: 'connected', deviceName: detail ?? 'DotPad-320' });
            break;
          case 'disconnected':
            dispatch({ type: 'dotpad/status', status: 'disconnected' });
            break;
          case 'error':
            dispatch({ type: 'dotpad/status', status: 'error' });
            break;
        }
      },
    };
    dotPadSession.connect(events).catch(() => {
      dispatch({ type: 'dotpad/status', status: 'error' });
    });
  }, [dispatch]);

  const disconnect = useCallback(() => {
    // The handle emits `disconnected` via the onStatus closure set at connect,
    // which drives the UI state — so we don't dispatch here (avoids double-log).
    // Fall back to an explicit dispatch only if there is no live handle.
    if (!dotPadSession.isConnected()) {
      dispatch({ type: 'dotpad/status', status: 'disconnected' });
      return;
    }
    dotPadSession.disconnect().catch(() => {
      dispatch({ type: 'dotpad/status', status: 'disconnected' });
    });
  }, [dispatch]);

  const retry = useCallback(() => connect(), [connect]);

  return {
    status: state.dotpadStatus,
    deviceName: state.deviceName,
    connect,
    disconnect,
    retry,
  };
}

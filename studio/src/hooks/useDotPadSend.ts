import { useCallback } from 'react';
import { useAppStore } from '../app/appState';
import * as dotPadSession from '../adapters/dotpad/session';
import { recordOutputSuccess } from '../analytics/activation';

/**
 * Send-to-DotPad hook.
 *
 * Flow: current TactileDocument → DotPadAdapter.encode() (via the session) →
 * mock transport line-diff send → clear success/error UI state. All encoding
 * lives in the adapter; this hook only gates on connection/document and maps
 * the async result onto send status. Shared by DotPadSendButton and the
 * Command Launcher.
 */
export function useDotPadSend() {
  const { state, dispatch } = useAppStore();

  const canSend =
    state.dotpadStatus === 'connected' &&
    state.document !== null &&
    state.sendStatus !== 'sending';

  const send = useCallback((): boolean => {
    const doc = state.document;
    if (state.dotpadStatus !== 'connected' || doc === null || state.sendStatus === 'sending') {
      return false;
    }
    dispatch({ type: 'send/status', status: 'sending' });
    dotPadSession
      .sendDocument(doc)
      .then(() => {
        dispatch({ type: 'send/status', status: 'sent' });
        // Spec §C: a successful DotPad output is the activation moment.
        recordOutputSuccess({ exportTarget: 'dotpad', gridSize: doc.resolution });
      })
      .catch(() => dispatch({ type: 'send/status', status: 'error' }));
    return true;
  }, [dispatch, state.dotpadStatus, state.document, state.sendStatus]);

  return { canSend, send };
}

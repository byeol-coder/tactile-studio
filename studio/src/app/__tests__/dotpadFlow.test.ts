import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState, type Action } from '../appState';
import { createEmptyGrid } from '../../utils/tactileGrid';
import type { TactileDocument } from '../../types/tactile';

/** Fold a sequence of actions through the reducer. */
function run(actions: Action[], from: AppState = initialState): AppState {
  return actions.reduce(reducer, from);
}

const doc: TactileDocument = {
  id: 'd',
  title: 'Flow',
  resolution: '60x40',
  cells: createEmptyGrid('60x40'),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('DotPad connect + send flow (adapter status events → UI state)', () => {
  it('connecting → connected mirrors the adapter onStatus events', () => {
    const s = run([
      { type: 'dotpad/status', status: 'connecting' },
      { type: 'dotpad/status', status: 'connected', deviceName: 'DotPad-320 (mock)' },
    ]);
    expect(s.dotpadStatus).toBe('connected');
    expect(s.deviceName).toBe('DotPad-320 (mock)');
  });

  it('send becomes ready only once a document exists and device is connected', () => {
    const connectedFirst = run([
      { type: 'dotpad/status', status: 'connected', deviceName: 'DotPad-320' },
    ]);
    expect(connectedFirst.sendStatus).toBe('idle'); // no document yet

    const withDoc = run([{ type: 'convert/done', document: doc }], connectedFirst);
    expect(withDoc.sendStatus).toBe('ready');
  });

  it('successful send: sending → sent', () => {
    const s = run([
      { type: 'dotpad/status', status: 'connected', deviceName: 'DotPad-320' },
      { type: 'convert/done', document: doc },
      { type: 'send/status', status: 'sending' },
      { type: 'send/status', status: 'sent' },
    ]);
    expect(s.sendStatus).toBe('sent');
    expect(s.canvasStatus).toBe('sent');
  });

  it('failed send: sending → error surfaces a clear log + state', () => {
    const s = run([
      { type: 'dotpad/status', status: 'connected', deviceName: 'DotPad-320' },
      { type: 'convert/done', document: doc },
      { type: 'send/status', status: 'sending' },
      { type: 'send/status', status: 'error' },
    ]);
    expect(s.sendStatus).toBe('error');
    expect(s.logs[s.logs.length - 1]).toMatchObject({ channel: 'dotpad', tone: 'error' });
  });

  it('disconnect resets send state', () => {
    const s = run([
      { type: 'dotpad/status', status: 'connected', deviceName: 'DotPad-320' },
      { type: 'convert/done', document: doc },
      { type: 'dotpad/status', status: 'disconnected' },
    ]);
    expect(s.dotpadStatus).toBe('disconnected');
    expect(s.deviceName).toBeNull();
    expect(s.sendStatus).toBe('idle');
  });
});

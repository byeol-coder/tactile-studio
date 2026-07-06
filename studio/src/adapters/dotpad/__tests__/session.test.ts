import { beforeEach, describe, expect, it } from 'vitest';
import * as session from '../session';
import { createEmptyGrid } from '../../../utils/tactileGrid';
import type { TactileDocument } from '../../../types/tactile';

function docWithDiagonal(len = 20): TactileDocument {
  const cells = createEmptyGrid('60x40');
  for (let i = 0; i < len; i++) {
    const c = cells.find((cell) => cell.x === i && cell.y === i);
    if (c) c.active = true;
  }
  return {
    id: 'd',
    title: 'Session Test',
    resolution: '60x40',
    cells,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('dotpad session (hook → adapter bridge)', () => {
  beforeEach(() => session.resetSession());

  it('connect() reports connecting → connected and marks the session live', async () => {
    const events: Array<[string, string | undefined]> = [];
    expect(session.isConnected()).toBe(false);
    await session.connect({ onStatus: (s, d) => events.push([s, d]) });
    expect(session.isConnected()).toBe(true);
    expect(events.map((e) => e[0])).toEqual(['connecting', 'connected']);
    expect(events[1][1]).toContain('DotPad');
  });

  it('connect() is idempotent and re-reports connected', async () => {
    await session.connect();
    const events: string[] = [];
    await session.connect({ onStatus: (s) => events.push(s) });
    expect(events).toEqual(['connected']);
    expect(session.isConnected()).toBe(true);
  });

  it('sendDocument() throws when not connected (drives the UI error path)', async () => {
    await expect(session.sendDocument(docWithDiagonal())).rejects.toThrow(/not connected/);
  });

  it('sendDocument() streams via the line-diff path', async () => {
    await session.connect();
    const doc = docWithDiagonal();

    // Before any send, every raised cell is pending.
    expect(session.pendingChanges(doc).length).toBe(60 * 40);

    await session.sendDocument(doc);
    // After sending the same doc, nothing is left to update.
    expect(session.pendingChanges(doc)).toEqual([]);

    // Flip one cell → only that cell is pending on the next send.
    const changed = { ...doc, cells: doc.cells.map((c) => ({ ...c })) };
    changed.cells[0].active = !changed.cells[0].active;
    expect(session.pendingChanges(changed)).toEqual([0]);
  });

  it('sendPreview() uses the same connected send path', async () => {
    await session.connect();
    const doc = docWithDiagonal();

    await session.sendPreview(doc);

    expect(session.pendingChanges(doc)).toEqual([]);
  });

  it('disconnect() clears the session and emits disconnected', async () => {
    const events: string[] = [];
    await session.connect({ onStatus: (s) => events.push(s) });
    await session.disconnect();
    expect(session.isConnected()).toBe(false);
    expect(events).toContain('disconnected');
  });

  it('a fresh connect after disconnect re-sends the full frame', async () => {
    await session.connect();
    const doc = docWithDiagonal();
    await session.sendDocument(doc);
    expect(session.pendingChanges(doc)).toEqual([]);

    await session.disconnect();
    await session.connect();
    // lastSentFrame reset on reconnect → the whole frame is pending again.
    expect(session.pendingChanges(doc).length).toBe(60 * 40);
  });
});

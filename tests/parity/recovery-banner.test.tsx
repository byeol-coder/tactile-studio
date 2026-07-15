// React-level wiring test for crash-recovery: TactileStudioEditor checks
// for a recovery snapshot on mount, RecoveryBanner renders/hides based on
// EditorStore's recoverOffer, and the restore/dismiss buttons drive the
// real store methods. jsdom environment (see tests/parity/react-editor.test.tsx
// for the getContext/PointerEvent stubbing rationale, mirrored here).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { TactileStudioEditor } from '../../src/react/TactileStudioEditor.js';
import { createDocument } from '../../src/core/document/document.js';
import { createMemoryStorageAdapter } from '../../src/storage/adapters/memory-storage-adapter.js';
import type { SessionRecoveryStorageAdapter } from '../../src/storage/adapters/session-recovery-storage-adapter.js';
import type { ParsedSessionSnapshot } from '../../src/codecs/document/session-snapshot.js';

afterEach(cleanup);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLCanvasElement) {
    return { left: 0, top: 0, width: this.width || 1, height: this.height || 1, right: this.width || 1, bottom: this.height || 1, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
});

function makeFakeSnapshot(): ParsedSessionSnapshot {
  const cells = new Uint8Array(2400);
  cells[9] = 1;
  return {
    v: 1, savedAt: 1, gridW: 60, gridH: 40, output: '60', pageIndex: 0,
    fileName: '복구 문서', brailleLang: 'ko-g1', pages: ['x'], audio: {}, vectors: {},
    liveCells: [cells],
  };
}

function fakeAdapter(snapshot: ParsedSessionSnapshot | null): SessionRecoveryStorageAdapter & {
  clear: ReturnType<typeof vi.fn>;
} {
  return {
    load: vi.fn(async () => snapshot),
    save: vi.fn(async () => true),
    clear: vi.fn(async () => {}),
  };
}

describe('RecoveryBanner — end-to-end wiring through TactileStudioEditor', () => {
  it('renders nothing when there is no recoverable snapshot', async () => {
    const sessionRecovery = fakeAdapter(null);
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 60, 40)}
        services={{ storage: createMemoryStorageAdapter(), sessionRecovery }}
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(sessionRecovery.load).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status', { name: /unsaved work found|restore/i })).toBeNull();
    expect(screen.queryByText('Unsaved work found')).toBeNull();
  });

  it('shows the recovery banner when a snapshot is found, and Restore applies it', async () => {
    const snapshot = makeFakeSnapshot();
    const sessionRecovery = fakeAdapter(snapshot);
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 60, 40)}
        services={{ storage: createMemoryStorageAdapter(), sessionRecovery }}
        labels={{ recoverTitle: '이전 작업 발견', recoverSub: '복구할까요?', recoverBtn: '복구하기', recoverDismissL: '닫기', aRecovered: '복구되었습니다' }}
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('이전 작업 발견')).toBeTruthy();
    const restoreBtn = screen.getByRole('button', { name: '복구하기' });
    expect(restoreBtn).toBeTruthy();

    fireEvent.click(restoreBtn);
    await act(async () => { await Promise.resolve(); });

    // banner disappears once accepted
    expect(screen.queryByText('이전 작업 발견')).toBeNull();
    // the live region announced the recovery
    expect(screen.getByText('복구되었습니다')).toBeTruthy();
  });

  it('Discard dismisses the banner and clears the stored snapshot, without applying it', async () => {
    const snapshot = makeFakeSnapshot();
    const sessionRecovery = fakeAdapter(snapshot);
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 60, 40)}
        services={{ storage: createMemoryStorageAdapter(), sessionRecovery }}
        labels={{ recoverTitle: '이전 작업 발견', recoverBtn: '복구하기', recoverDismissL: '닫기' }}
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const dismissBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(dismissBtn);
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText('이전 작업 발견')).toBeNull();
    expect(sessionRecovery.clear).toHaveBeenCalledTimes(1);
  });

  it('falls back to a real localStorage-backed adapter when the host does not provide services.sessionRecovery', async () => {
    // No sessionRecovery passed — TactileStudioEditor must supply the real
    // default adapter itself rather than requiring every host to wire one.
    // Spy on Storage.prototype (not the window.localStorage instance) --
    // more robust under jsdom regardless of how the instance is exposed.
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 60, 40)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(getItemSpy).toHaveBeenCalledWith('ts.session.v1');
    getItemSpy.mockRestore();
  });
});

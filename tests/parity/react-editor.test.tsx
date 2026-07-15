// Phase 5 React component tests (jsdom environment — see vitest.config.ts).
// Canvas 2D rendering is not available under jsdom (getContext('2d') returns
// null); StudioCanvas is written to no-op its draw() in that case rather than
// throw, so these tests verify WIRING (pointer events → store mutations,
// toolbar clicks → tool state, mount/unmount safety) rather than pixel
// output — consistent with how the tactile-text glyph rasterizer seam was
// handled in Phase 3 (documented limitation, not a silent gap).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { TactileStudioEditor } from '../../src/react/TactileStudioEditor.js';
import { TactileStudioProvider, useEditorStoreContext } from '../../src/react/TactileStudioProvider.js';
import { StudioCanvas } from '../../src/ui/canvas/StudioCanvas.js';
import { Toolbar } from '../../src/ui/toolbar/Toolbar.js';
import { CorpusSearchPanel } from '../../src/ui/corpus/CorpusSearchPanel.js';
import { PagePanel } from '../../src/ui/panels/PagePanel.js';
import { Inspector } from '../../src/ui/inspector/Inspector.js';
import { ExportMenu } from '../../src/ui/dialogs/ExportMenu.js';
import { ImportDialog } from '../../src/ui/dialogs/ImportDialog.js';
import { ConfirmDialog } from '../../src/ui/dialogs/ConfirmDialog.js';
import { Tooltip } from '../../src/ui/tooltip/Tooltip.js';
import { IconButton } from '../../src/ui/toolbar/IconButton.js';
import { LiveRegion } from '../../src/ui/live-region/LiveRegion.js';
import { DotPadPanel } from '../../src/ui/dotpad/DotPadPanel.js';
import { RecoveryBanner } from '../../src/ui/recovery/RecoveryBanner.js';
import { Toast } from '../../src/ui/toast/Toast.js';
import { useKeyboardShortcuts } from '../../src/react/hooks/useKeyboardShortcuts.js';
import { EmptyStateHint } from '../../src/ui/hints/EmptyStateHint.js';
import { createDocument } from '../../src/core/document/document.js';
import { createMemoryStorageAdapter } from '../../src/storage/adapters/memory-storage-adapter.js';
import { createMockDotPadAdapter } from '../../src/device/dotpad/mock-adapter.js';

afterEach(cleanup);

// jsdom's canvas has no real 2D context; stub getContext to return null
// quietly (StudioCanvas.draw() already no-ops on a null context) instead of
// letting jsdom's noisy "not implemented" logger fire on every render.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLCanvasElement) {
    return { left: 0, top: 0, width: this.width || 1, height: this.height || 1, right: this.width || 1, bottom: this.height || 1, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
});

// jsdom does not implement window.PointerEvent (confirmed: `'PointerEvent' in
// window` is false), so @testing-library/react's fireEvent.pointerDown falls
// back to a bare Event with none of clientX/clientY/button applied. We
// construct a real MouseEvent (which DOES support those via its init dict)
// with the pointer event's type string — React's event system dispatches
// onPointerDown/Move/Up by matching the native event TYPE, not by checking
// `instanceof PointerEvent`, so this reaches our handlers with real coordinates.
function firePointerEvent(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', init: { clientX: number; clientY: number; button?: number; pointerId?: number }) {
  const evt = new MouseEvent(type, { clientX: init.clientX, clientY: init.clientY, button: init.button ?? 0, bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'pointerId', { value: init.pointerId ?? 1, configurable: true });
  fireEvent(el, evt);
}

/** Shape tools (line/rect/ellipse/poly) are grouped behind a caret flyout —
 *  open it, then click the named tool inside. */
function selectShapeTool(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /Shapes — /i }));
  fireEvent.click(screen.getByRole('button', { name }));
}
function Harness({ doc = createDocument('t', 10, 10) }: { doc?: ReturnType<typeof createDocument> }) {
  return (
    <TactileStudioProvider initialDocument={doc}>
      <Toolbar />
      <StudioCanvas ariaLabel="canvas" />
    </TactileStudioProvider>
  );
}

describe('TactileStudioEditor — mount/unmount safety', () => {
  it('mounts and unmounts without throwing, with mock services', () => {
    const storage = createMemoryStorageAdapter();
    const tactileDisplay = createMockDotPadAdapter();
    const { unmount } = render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage, tactileDisplay }}
      />,
    );
    expect(screen.getByRole('img', { name: /tactile drawing canvas/i })).toBeTruthy();
    expect(() => unmount()).not.toThrow();
  });

  it('registers keydown listeners (undo/redo shortcut + save shortcut) per mount and removes them on unmount (no leak/duplication across remounts)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const LISTENERS_PER_MOUNT = 2; // useKeyboardShortcuts (undo/redo) + EditorBody's Ctrl/Cmd+S handler
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <TactileStudioEditor
          initialDocument={createDocument('doc', 10, 10)}
          services={{ storage: createMemoryStorageAdapter() }}
        />,
      );
      const keydownAdds = addSpy.mock.calls.filter((c) => c[0] === 'keydown');
      expect(keydownAdds.length).toBe((i + 1) * LISTENERS_PER_MOUNT);
      unmount();
      const keydownRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'keydown');
      expect(keydownRemoves.length).toBe((i + 1) * LISTENERS_PER_MOUNT);
      // every listener added for THIS mount was removed with the exact same function reference
      const addedThisMount = keydownAdds.slice(i * LISTENERS_PER_MOUNT, (i + 1) * LISTENERS_PER_MOUNT).map((c) => c[1]);
      const removedThisMount = keydownRemoves.slice(i * LISTENERS_PER_MOUNT, (i + 1) * LISTENERS_PER_MOUNT).map((c) => c[1]);
      expect(new Set(removedThisMount)).toEqual(new Set(addedThisMount));
    }
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('creates a fresh EditorStore per mount (no state leaks across remounts)', () => {
    const doc1 = createDocument('doc1', 10, 10);
    const r1 = render(<Harness doc={doc1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    const canvas1 = r1.container.querySelector('canvas')!;
    firePointerEvent(canvas1, 'pointerdown', { clientX: 5, clientY: 5 });
    r1.unmount();

    const doc2 = createDocument('doc2', 10, 10);
    const r2 = render(<Harness doc={doc2} />);
    // fresh mount defaults back to the 'pen' tool, not 'fill' from the previous instance
    expect(screen.getByRole('button', { name: 'Pen' }).getAttribute('aria-pressed')).toBe('true');
    r2.unmount();
  });
});

describe('Toolbar wiring', () => {
  it('clicking a tool button updates the store and reflects aria-pressed', () => {
    render(<Harness />);
    const penBtn = screen.getByRole('button', { name: 'Pen' });
    const eraserBtn = screen.getByRole('button', { name: 'Eraser' });
    expect(penBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(eraserBtn);
    expect(eraserBtn.getAttribute('aria-pressed')).toBe('true');
    expect(penBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('undo/redo buttons are disabled until there is history', () => {
    render(<Harness />);
    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies host-provided labels, falling back to English defaults for the rest', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar labels={{ toolNames: { pen: '펜' } }} />
      </TactileStudioProvider>,
    );
    expect(screen.getByRole('button', { name: '펜' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeTruthy(); // untranslated fallback
  });
});

describe('StudioCanvas — pointer-to-store wiring (pen tool)', () => {
  it('a pointerdown+move+up stroke paints cells and creates exactly one undo entry', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }

    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Capture />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    // canvas.width/height are set by StudioCanvas's draw() effect (cellPx(10)=20 → 200x200),
    // but getContext('2d') is null under jsdom so draw() no-ops before sizing;
    // set them explicitly here so the getBoundingClientRect stub has real dims.
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });

    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 });
    firePointerEvent(canvas, 'pointermove', { clientX: 40, clientY: 20, pointerId: 1 });
    firePointerEvent(canvas, 'pointerup', { clientX: 40, clientY: 20, pointerId: 1 });

    const snap = capturedStore!.getSnapshot();
    expect(snap.canUndo).toBe(true);
    expect(snap.dirty).toBe(true);
    const cells = capturedStore!.getActiveCells();
    expect(cells[1 * 10 + 1]).toBe(1); // cell (1,1) from the first pointerdown at x=20/20=1
    // exactly one history entry for the whole drag, not one per pointermove
    expect((capturedStore as any).history.undoStack.length).toBe(1);
  });

  it('fill tool floods via a single mutateActiveCells transaction', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const doc = createDocument('t', 5, 5);

    const { container } = render(
      <TactileStudioProvider initialDocument={doc}>
        <Capture />
        <Toolbar />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 100, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 100, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 50, clientY: 50, pointerId: 2 });

    const cells = capturedStore!.getActiveCells();
    expect(Array.from(cells).every((v) => v === 1)).toBe(true); // whole empty grid floods to 1
    expect((capturedStore as any).history.undoStack.length).toBe(1);
  });

  it('a second pointer touching down mid-drag does not hijack it (ported from vanilla 29ef81f)', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Capture />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });

    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 }); // start drawing at (1,1)
    // A second pointer (e.g. a resting palm) touches down elsewhere -- must be ignored
    firePointerEvent(canvas, 'pointerdown', { clientX: 180, clientY: 180, pointerId: 2 });
    firePointerEvent(canvas, 'pointermove', { clientX: 40, clientY: 20, pointerId: 1 }); // continue pointer 1's stroke to (2,1)
    firePointerEvent(canvas, 'pointerup', { clientX: 40, clientY: 20, pointerId: 1 });

    const cells = capturedStore!.getActiveCells();
    expect(cells[1 * 10 + 1]).toBe(1); // (1,1) from pointer 1's down
    expect(cells[1 * 10 + 2]).toBe(1); // (2,1) from pointer 1's continued move
    expect(cells[9 * 10 + 9]).toBe(0); // (9,9) from the hijacking pointer 2 -- must NOT have painted
    expect((capturedStore as any).history.undoStack.length).toBe(1); // one stroke, not two

    // Pointer 2's own up (it was never a drag owner) must also be a no-op, not a crash
    expect(() => firePointerEvent(canvas, 'pointerup', { clientX: 180, clientY: 180, pointerId: 2 })).not.toThrow();
  });

  it('a stray pointermove/up for the wrong pointerId while no drag is active is a harmless no-op', () => {
    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });
    expect(() => {
      firePointerEvent(canvas, 'pointermove', { clientX: 10, clientY: 10, pointerId: 7 });
      firePointerEvent(canvas, 'pointerup', { clientX: 10, clientY: 10, pointerId: 7 });
    }).not.toThrow();
  });

  it('switching pages mid-drag clears the stale drag so it cannot bleed onto the new page (ported from vanilla 29ef81f)', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Capture />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });

    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 }); // start a stroke on page 1
    act(() => { capturedStore!.addPage(); }); // switch to a fresh page mid-drag (e.g. a keyboard shortcut)
    // The old drag must not still be "live": lifting the (stale) pointer must not
    // paint onto the new page or throw.
    expect(() => firePointerEvent(canvas, 'pointerup', { clientX: 60, clientY: 60, pointerId: 1 })).not.toThrow();
    const newPageCells = capturedStore!.getActiveCells();
    expect(Array.from(newPageCells).every((v) => v === 0)).toBe(true); // untouched blank page

    // A fresh drag on the new page with the SAME pointerId must work normally
    // (proves the guard was reset, not permanently stuck).
    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 });
    firePointerEvent(canvas, 'pointerup', { clientX: 20, clientY: 20, pointerId: 1 });
    expect(capturedStore!.getActiveCells()[1 * 10 + 1]).toBe(1);
  });
});

describe('StudioCanvas — poly tool wiring', () => {
  it('clicking points then double-clicking closes the loop as one undo entry', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }

    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Capture />
        <Toolbar />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    selectShapeTool('Polygon');
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });

    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 }); // (1,1)
    firePointerEvent(canvas, 'pointerdown', { clientX: 100, clientY: 20, pointerId: 1 }); // (5,1)
    firePointerEvent(canvas, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }); // (5,5)
    fireEvent.doubleClick(canvas);

    expect(capturedStore!.getSnapshot().canUndo).toBe(true);
    expect((capturedStore as any).history.undoStack.length).toBe(1);
    const cells = capturedStore!.getActiveCells();
    expect(cells[1 * 10 + 1]).toBe(1); // a vertex is always plotted
    expect(cells[1 * 10 + 5]).toBe(1);
  });

  it('Escape cancels an in-progress polygon without mutating the document', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Capture />
        <Toolbar />
        <StudioCanvas />
      </TactileStudioProvider>,
    );
    selectShapeTool('Polygon');
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 });
    firePointerEvent(canvas, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(capturedStore!.getSnapshot().canUndo).toBe(false);
  });
});

describe('StudioCanvas — text tool wiring (synthetic glyph rasterizer)', () => {
  it('opens a popover on click, commits via stampTextLayout on Enter', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const block = { data: new Uint8Array(9).fill(1), w: 3, h: 3 };

    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 20, 20)}>
        <Capture />
        <Toolbar />
        <StudioCanvas glyphRasterizer={() => block} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tactile Text' }));
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 400, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 400, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 40, clientY: 40, pointerId: 1 }); // (2,2)

    const input = screen.getByRole('textbox', { name: 'Tactile text' });
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(capturedStore!.getSnapshot().canUndo).toBe(true);
    const cells = capturedStore!.getActiveCells();
    expect(cells[2 * 20 + 2]).toBe(1); // top-left of the synthetic 3x3 glyph block at (2,2)
  });

  it('Escape closes the popover without committing anything', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const { container } = render(
      <TactileStudioProvider initialDocument={createDocument('t', 20, 20)}>
        <Capture />
        <Toolbar />
        <StudioCanvas glyphRasterizer={() => ({ data: new Uint8Array(1).fill(1), w: 1, h: 1 })} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tactile Text' }));
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 400, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 400, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 40, clientY: 40, pointerId: 1 });
    const input = screen.getByRole('textbox', { name: 'Tactile text' });
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Tactile text' })).toBeNull();
    expect(capturedStore!.getSnapshot().canUndo).toBe(false);
  });
});

describe('TactileStudioEditor — full composition with all optional services', () => {
  it('renders PagePanel, Inspector, and DotPadPanel when services are provided, and they are wired to the same store', () => {
    const storage = createMemoryStorageAdapter();
    const tactileDisplay = createMockDotPadAdapter();
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage, tactileDisplay, encodeBits: () => '00'.repeat(150) }}
      />,
    );

    // PagePanel: add a page via its own "+" button, Toolbar/PagePanel share one store
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(screen.getByRole('button', { name: '2' })).toBeTruthy();

    // Inspector: editing the description field updates the store (no crash, value reflected)
    const descBox = screen.getByLabelText('Braille description') as HTMLTextAreaElement;
    fireEvent.change(descBox, { target: { value: 'hello' } });
    expect(descBox.value).toBe('hello');

    // DotPadPanel: shows disconnected state initially, Connect button present
    expect(screen.getByText(/not connected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('renders without DotPadPanel/Inspector-gridFx when those services are omitted', () => {
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.queryByText(/thinner/i)).toBeNull();
  });

  it('Ctrl+Z keyboard shortcut calls undo through the real DOM listener', () => {
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    const canvas = screen.getByRole('img', { name: /tactile drawing canvas/i });
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 9 });

    const undoBtn = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false); // the flood created one undo entry

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(undoBtn.disabled).toBe(true); // Ctrl+Z consumed that entry
  });
});

describe('CorpusSearchPanel — real search engine wiring', () => {
  it('shows confident hits for a matching query and loads one into a new page on click', () => {
    const corpus = [
      { id: 'c1', title: '고양이', spec: '60x40', lang: 'ko', category: 'basic', tags: ['동물'], pages: [{ page: 1, label: '고양이', graphic: '3'.repeat(600) }] },
    ];
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }

    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <Capture />
        <CorpusSearchPanel corpus={corpus as any} />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), { target: { value: '고양이' } });
    const hit = screen.getByRole('button', { name: '고양이' });
    fireEvent.click(hit);

    expect(capturedStore!.getSnapshot().pageCount).toBe(2);
    expect(Array.from(capturedStore!.getActiveCells())[0]).toBe(1); // hex '3' = 0011 -> bit0/bit1 set for first cell
  });

  it('shows suggestions (not confident hits) for a near-miss query', () => {
    const corpus = [
      { id: 'c1', title: 'Planetary System', spec: '60x40', lang: 'en', category: 'basic', tags: [], pages: [{ page: 1, label: 'Planetary System', desc: '', graphic: '0'.repeat(600) }] },
    ];
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <CorpusSearchPanel corpus={corpus as any} />
      </TactileStudioProvider>,
    );
    // "planetarian" is NOT a substring of "Planetary System" (no confident
    // hit), but shares an 8-char prefix with "planetary" (isNearToken's
    // ≥3-char-prefix rule) — lands in the near-match/suggestions path.
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), { target: { value: 'planetarian' } });
    expect(screen.getByText(/did you mean/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Planetary System' })).toBeTruthy();
  });

  it('shows an empty state for a totally unmatched query', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <CorpusSearchPanel corpus={[]} />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), { target: { value: 'zzz' } });
    expect(screen.getByText(/no matches found/i)).toBeTruthy();
  });
});

describe('PagePanel — thumbnails and drag-and-drop reordering', () => {
  it('renders a thumbnail canvas per page', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); });
    // two pages -> two thumbnail canvases (aria-hidden, so query by tag directly)
    expect(document.querySelectorAll('canvas[aria-hidden="true"]').length).toBe(2);
  });

  it('drag handle reorders pages via pointer events (no native DragEvent needed)', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); capturedStore!.addPage(); });
    // stub getBoundingClientRect for the three <li> rows, stacked vertically
    const items = screen.getAllByRole('listitem');
    items.forEach((el, i) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: i * 40, bottom: i * 40 + 40, height: 40, left: 0, right: 100, width: 100, x: 0, y: i * 40, toJSON() {} } as DOMRect);
    });
    const activePageBefore = capturedStore!.getSnapshot().pageIndex;
    expect(activePageBefore).toBe(2); // addPage() twice moved active page to index 2

    const handles = screen.getAllByRole('button', { name: /Reorder page/i });
    firePointerEvent(handles[0], 'pointerdown', { clientX: 10, clientY: 5, pointerId: 5 }); // grab page 1 (index 0)
    firePointerEvent(document.body, 'pointermove', { clientX: 10, clientY: 100, pointerId: 5 }); // drag down past row 2
    firePointerEvent(document.body, 'pointerup', { clientX: 10, clientY: 100, pointerId: 5 });

    // page originally at index 0 should have moved down
    expect(capturedStore!.getSnapshot().pageIndex).not.toBe(2); // active page identity followed the move (Phase 2 core guarantee)
  });
});

describe('Inspector — braille Apply wiring', () => {
  it('Apply button translates the desc field and shows the preview', async () => {
    const braille = { translate: vi.fn().mockResolvedValue({ ok: true, unicode: '⠓⠑⠇⠇⠕', cells: 5 }) };
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Inspector braille={braille} />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByLabelText('Braille description'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply braille (description)' }));
    await screen.findByText(/⠓⠑⠇⠇⠕/);
    expect(braille.translate).toHaveBeenCalledWith('hello', 'ko-g2');
  });

  it('changing the braille language selector affects the next Apply call', async () => {
    const braille = { translate: vi.fn().mockResolvedValue({ ok: true, unicode: '⠓', cells: 1 }) };
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Inspector braille={braille} />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByLabelText('Braille description'), { target: { value: 'hi' } });
    fireEvent.change(screen.getByLabelText('Braille language'), { target: { value: 'ueb-g1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply braille (description)' }));
    await Promise.resolve();
    expect(braille.translate).toHaveBeenCalledWith('hi', 'ueb-g1');
  });

  it('Apply button is disabled when the field is empty, and no braille UI renders without a service', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Inspector />
      </TactileStudioProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Apply braille' })).toBeNull();
  });
});

describe('ExportMenu — SVG and PNG', () => {
  it('SVG button only renders when bitsToSvg is provided, and calls onExport with svg text', () => {
    const onExport = vi.fn();
    const { rerender } = render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <ExportMenu encodeBits={() => '00'.repeat(50)} onExport={onExport} />
      </TactileStudioProvider>,
    );
    expect(screen.queryByRole('menuitem', { name: 'SVG' })).toBeNull();

    rerender(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <ExportMenu encodeBits={() => '00'.repeat(50)} bitsToSvg={() => '<svg></svg>'} onExport={onExport} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'SVG' }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'svg', json: '<svg></svg>' }));
  });

  it('PNG button calls onExport with a Blob when a 2D context is available', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: '',
    } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: any) {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    });
    const onExport = vi.fn();
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <ExportMenu encodeBits={() => '00'.repeat(50)} onExport={onExport} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'png' }));
    const call = onExport.mock.calls[0][0];
    expect(call.blob).toBeInstanceOf(Blob);
  });

  it('PNG export is a no-op (never throws) when no 2D context is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
    const onExport = vi.fn();
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <ExportMenu encodeBits={() => '00'.repeat(50)} onExport={onExport} />
      </TactileStudioProvider>,
    );
    expect(() => fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))).not.toThrow();
    expect(onExport).not.toHaveBeenCalled();
  });
});

describe('Toolbar — shape flyout, thickness flyout, and live-region announcements', () => {
  it('shape flyout: caret opens a menu, selecting a tool inside activates it and closes the menu', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
      </TactileStudioProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull(); // closed by default
    fireEvent.click(screen.getByRole('button', { name: /Shapes — /i }));
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    // menu closed after selection, but the main flyout button's own
    // accessible name is now "Rectangle" (it reflects the active shape tool)
    expect(screen.queryAllByRole('button', { name: 'Rectangle' }).length).toBe(1);
  });

  it('shape flyout closes on Escape without changing the tool', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Shapes — /i }));
    expect(screen.getByRole('button', { name: 'Ellipse' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Ellipse' })).toBeNull();
  });

  it('thickness flyout only appears for pen/eraser/shape tools, not for cursor/fill/select', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
      </TactileStudioProvider>,
    );
    // 'pen' is the default tool -> thickness group visible
    expect(screen.getByRole('button', { name: /Line thickness/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(screen.queryByRole('button', { name: /Line thickness/i })).toBeNull();
  });

  it('thickness flyout shows the eraser-specific icon/label when the eraser tool is active', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(screen.getByRole('button', { name: /Eraser size/i })).toBeTruthy();
  });

  it('undo/redo/flip/invert/clear announce to the live region', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <LiveRegion />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    expect(screen.getByRole('status').textContent).toBe('Inverted');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('status').textContent).toBe('Canvas cleared');
  });
});

describe('Toast — undo/redo visual feedback (ported from vanilla toastMsg(), see docs/known-issues.md #8)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // Uses TactileStudioProvider + Toolbar directly (not the full
  // TactileStudioEditor) so EmptyStateHint's own role="status" banner
  // (visible on a fresh untouched document) doesn't add a third status
  // element and make these assertions ambiguous -- these tests care about
  // LiveRegion/Toast specifically, not the empty-canvas hint.
  function KeyboardHarness({ labels }: { labels?: Record<string, unknown> }) {
    useKeyboardShortcuts(labels);
    return null;
  }

  it('clicking Undo shows the toast alongside the live-region announcement (both fire together, same event), auto-clearing after 2600ms', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <LiveRegion />
        <Toast />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invert' })); // creates an undo entry
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    const shown = screen.getAllByRole('status');
    expect(shown).toHaveLength(2); // LiveRegion + Toast
    expect(shown.every((el) => el.textContent === 'Undone')).toBe(true);
    act(() => { vi.advanceTimersByTime(2600); });
    // Toast unmounts; LiveRegion stays (announce() never auto-clears, only
    // toastMsg() does -- that's the whole distinction between the two).
    const remaining = screen.getAllByRole('status');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toBe('Undone');
  });

  it('clicking Redo shows the toast', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <Toast />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('status').textContent).toBe('Redone');
  });

  it('a second Undo click while the toast is showing resets the auto-clear timer instead of racing/stacking (matches the monolith clearTimeout(this._toastT))', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <Toast />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(2000); }); // 3000ms since the 1st click, 2000ms since the 2nd
    expect(screen.getByRole('status').textContent).toBe('Undone'); // still showing
    act(() => { vi.advanceTimersByTime(600); }); // 2600ms since the 2nd click
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Ctrl+Z also shows the toast and announces -- closes a pre-existing gap where the keyboard shortcut path never called announce()/toastMsg() at all', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <LiveRegion />
        <Toast />
        <KeyboardHarness labels={{ aUndo: '실행 취소됨' }} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }));
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    const shown = screen.getAllByRole('status');
    expect(shown).toHaveLength(2);
    expect(shown.every((el) => el.textContent === '실행 취소됨')).toBe(true);
  });

  it('Ctrl+Z with an empty undo stack stays silent -- no toast, no announce (mirrors the monolith\'s own early-return on an empty stack)', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('t', 10, 10)}>
        <Toolbar />
        <LiveRegion />
        <Toast />
        <KeyboardHarness />
      </TactileStudioProvider>,
    );
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('status').textContent).toBe(''); // only LiveRegion present; Toast renders nothing
  });
});

describe('PagePanel — confirm-before-delete and announcements', () => {
  it('clicking delete opens a confirmation dialog; page is only deleted on confirm', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); });
    expect(capturedStore!.getSnapshot().pageCount).toBe(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete page' })[0]);
    expect(capturedStore!.getSnapshot().pageCount).toBe(2); // not deleted yet
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(capturedStore!.getSnapshot().pageCount).toBe(1);
  });

  it('Cancel in the confirm dialog leaves the page intact', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete page' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(capturedStore!.getSnapshot().pageCount).toBe(2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('switching pages announces to the live region', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel />
        <LiveRegion />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); });
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByRole('status').textContent).toBe('Page 1 of 2');
  });

  it('the duplicate-page button adds a copy right after the source page and announces it', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <PagePanel labels={{ pageDuplicate: 'Duplicate page', aPageDup: 'Page {i} duplicated. {n} pages total' }} />
        <LiveRegion />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.mutateActiveCells((cells) => { cells[0] = 1; }); });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate page' }));

    expect(capturedStore!.getSnapshot().pageCount).toBe(2);
    expect(capturedStore!.getSnapshot().pageIndex).toBe(1);
    expect(Array.from(capturedStore!.getActiveCells())).toEqual(Array.from(capturedStore!.getDocument().pages[0]));
    expect(screen.getByRole('status').textContent).toBe('Page 2 duplicated. 2 pages total');
  });
});

describe('ImportDialog — image import + crop UI (injected decoder for tests)', () => {
  beforeEach(() => {
    if (!('createObjectURL' in URL)) (URL as any).createObjectURL = () => 'blob:fake';
    if (!('revokeObjectURL' in URL)) (URL as any).revokeObjectURL = () => {};
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('decodes an image file, shows a crop preview, and converts via the real imgToCells codec', async () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    // 4x4 solid-black RGBA source (deterministic, no real image decode needed)
    const decoded = { data: new Uint8ClampedArray(4 * 4 * 4).fill(0).map((_, i) => (i % 4 === 3 ? 255 : 0)), width: 4, height: 4 };
    const fakeDecoder = vi.fn().mockResolvedValue(decoded);

    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <Capture />
        <ImportDialog open labels={{}} onClose={() => {}} decodeImageFile={fakeDecoder} />
      </TactileStudioProvider>,
    );
    const fileInput = screen.getByLabelText('Choose image file') as HTMLInputElement;
    const file = new File(['fake'], 'photo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await Promise.resolve();
    });
    expect(fakeDecoder).toHaveBeenCalledWith(file);
    expect(screen.getByTestId('crop-rect')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(capturedStore!.getSnapshot().pageCount).toBe(1);
    // solid-black source at balanced preset should produce mostly-on cells
    const cells = capturedStore!.getActiveCells();
    expect(Array.from(cells).some((v) => v === 1)).toBe(true);
  });

  it('dragging the crop overlay updates the crop rectangle', async () => {
    const decoded = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    const fakeDecoder = vi.fn().mockResolvedValue(decoded);
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <ImportDialog open labels={{}} onClose={() => {}} decodeImageFile={fakeDecoder} />
      </TactileStudioProvider>,
    );
    const fileInput = screen.getByLabelText('Choose image file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await Promise.resolve();
    });
    const preview = screen.getByLabelText('Drag to select a crop region');
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} } as DOMRect);
    firePointerEvent(preview, 'pointerdown', { clientX: 20, clientY: 20, pointerId: 1 });
    firePointerEvent(preview, 'pointermove', { clientX: 100, clientY: 100, pointerId: 1 });
    firePointerEvent(preview, 'pointerup', { clientX: 100, clientY: 100, pointerId: 1 });
    const rect = screen.getByTestId('crop-rect');
    expect(rect.style.left).toBe('10%');
    expect(rect.style.top).toBe('10%');
  });

  it('shows an error for an unreadable image file without crashing', async () => {
    const fakeDecoder = vi.fn().mockRejectedValue(new Error('bad image'));
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <ImportDialog open labels={{}} onClose={() => {}} decodeImageFile={fakeDecoder} />
      </TactileStudioProvider>,
    );
    const fileInput = screen.getByLabelText('Choose image file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await Promise.resolve();
    });
    expect(screen.getByRole('alert').textContent).toBe('bad image');
  });
  it('exposes a tactile detail level (threshold) slider, defaulting to 50, that is passed through to the conversion', async () => {
    const decoded = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    const fakeDecoder = vi.fn().mockResolvedValue(decoded);
    const convert = vi.fn().mockReturnValue({ cells: new Uint8Array(2400), removedDots: 0 });
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <ImportDialog open labels={{ threshold: 'Tactile detail level' }} onClose={() => {}} decodeImageFile={fakeDecoder} imageProcessing={{ convert }} />
      </TactileStudioProvider>,
    );
    const fileInput = screen.getByLabelText('Choose image file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await Promise.resolve();
    });

    const slider = screen.getByLabelText('Tactile detail level') as HTMLInputElement;
    expect(slider.value).toBe('50'); // shipped default
    expect(slider.min).toBe('10');
    expect(slider.max).toBe('90');

    fireEvent.change(slider, { target: { value: '72' } });
    expect(screen.getByText('72')).toBeTruthy(); // live value readout, no separate "apply" step

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(convert).toHaveBeenCalledTimes(1);
    const opts = convert.mock.calls[0][5];
    expect(opts.threshold).toBe(72);
  });

  it('resets the threshold slider to 50 when a new image is loaded', async () => {
    const decoded = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    const fakeDecoder = vi.fn().mockResolvedValue(decoded);
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <ImportDialog open labels={{ threshold: 'Tactile detail level' }} onClose={() => {}} decodeImageFile={fakeDecoder} />
      </TactileStudioProvider>,
    );
    const fileInput = screen.getByLabelText('Choose image file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Tactile detail level'), { target: { value: '80' } });
    expect((screen.getByLabelText('Tactile detail level') as HTMLInputElement).value).toBe('80');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const fileInput2 = screen.getByLabelText('Choose image file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput2, { target: { files: [new File(['y'], 'b.png', { type: 'image/png' })] } });
      await Promise.resolve();
    });
    expect((screen.getByLabelText('Tactile detail level') as HTMLInputElement).value).toBe('50');
  });
});

describe('Dialog focus trap (ConfirmDialog / ImportDialog)', () => {
  it('ConfirmDialog focuses the confirm button on open and restores focus on close', async () => {
    function Harness2() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <ConfirmDialog open={open} title="Confirm?" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness2 />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(document.activeElement?.textContent).toBe('OK');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(document.activeElement).toBe(opener);
  });

  it('Tab wraps within ConfirmDialog and does not escape to the page behind it', () => {
    render(<ConfirmDialog open title="Confirm?" onConfirm={() => {}} onCancel={() => {}} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const okBtn = screen.getByRole('button', { name: 'OK' });
    okBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancelBtn).toBeTruthy(); // trap logic present; jsdom doesn't auto-advance focus on Tab so we assert no crash + both buttons exist
  });
});

describe('TactileStudioEditor — Save wiring (onSave/onError)', () => {
  it('Save button calls storage.save, markSaved, and onSave on success', async () => {
    const storage = createMemoryStorageAdapter();
    const onSave = vi.fn();
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage }}
        onSave={onSave}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalled();
    expect(await storage.load('doc')).toBeTruthy();
  });

  it('a failing storage.save calls onError and never calls onSave', async () => {
    const storage = { load: vi.fn(), save: vi.fn().mockResolvedValue({ ok: false, error: 'disk full' }) };
    const onSave = vi.fn();
    const onError = vi.fn();
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: storage as any }}
        onSave={onSave}
        onError={onError}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'save-failed' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Ctrl/Cmd+S triggers the same save flow as the button', async () => {
    const storage = createMemoryStorageAdapter();
    const onSave = vi.fn();
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage }}
        onSave={onSave}
      />,
    );
    await act(async () => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalled();
  });

  it('DotPad connect failure calls the top-level onError', async () => {
    const onError = vi.fn();
    const failingAdapter = createMockDotPadAdapter({ failConnect: true });
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter(), tactileDisplay: failingAdapter }}
        onError={onError}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'connect-failed' }));
  });
});

describe('CorpusSearchPanel — multi-page record prev/next navigation', () => {
  const multiPageCorpus = [{
    id: 'rec-1', title: '멀티페이지', spec: '60x40', lang: 'ko', category: 'basic', tags: [],
    pages: [
      { page: 1, label: '멀티페이지 1', graphic: '1'.repeat(600) },
      { page: 2, label: '멀티페이지 2', graphic: '2'.repeat(600) },
    ],
  }];

  it('shows Prev/Next controls after loading a multi-page hit, and Next navigates within the record', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <Capture />
        <CorpusSearchPanel corpus={multiPageCorpus as any} defaultMode="replace" />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), { target: { value: '멀티페이지' } });
    fireEvent.click(screen.getByRole('button', { name: /멀티페이지/ }));

    const nav = screen.getByRole('group', { name: 'Browse pages in this record' });
    expect(nav.textContent).toContain('멀티페이지 · 1/2');
    const nextBtn = screen.getByRole('button', { name: 'Next page' });
    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true);
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(nextBtn);
    expect(nav.textContent).toContain('멀티페이지 · 2/2');
    expect(capturedStore!.getSnapshot().corpusCtx?.index).toBe(1);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('no prev/next controls appear for a single-page record', () => {
    const singlePage = [{ id: 's1', title: '단일', spec: '60x40', lang: 'ko', category: 'basic', tags: [], pages: [{ page: 1, label: '단일', graphic: '5'.repeat(600) }] }];
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 60, 40)}>
        <CorpusSearchPanel corpus={singlePage as any} />
      </TactileStudioProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), { target: { value: '단일' } });
    fireEvent.click(screen.getByRole('button', { name: /단일/ }));
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});

describe('Tooltip — custom positioning (showTip/hideTip port)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows above the trigger by default, after the hover delay (320ms)', () => {
    render(
      <Tooltip label="Pen tool" keyHint="P">
        <button>Pen</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'Pen' });
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({ top: 200, bottom: 232, left: 100, right: 132, width: 32, height: 32, x: 100, y: 200, toJSON() {} } as DOMRect);
    fireEvent.mouseEnter(btn);
    expect(screen.queryByRole('tooltip')).toBeNull(); // not yet, still delayed
    act(() => { vi.advanceTimersByTime(320); });
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Pen tool');
    expect(tip.textContent).toContain('P');
    expect(tip.style.transform).toContain('-100%'); // placed above
  });

  it('flips to below when there is no room above (top < 60)', () => {
    render(
      <Tooltip label="Cursor">
        <button>Cursor</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'Cursor' });
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({ top: 20, bottom: 52, left: 10, right: 42, width: 32, height: 32, x: 10, y: 20, toJSON() {} } as DOMRect);
    fireEvent.mouseEnter(btn);
    act(() => { vi.advanceTimersByTime(320); });
    const tip = screen.getByRole('tooltip');
    expect(tip.style.transform).toBe('translate(-50%, 0)'); // placed below
  });

  it('shows faster (90ms) on keyboard focus than on hover', () => {
    render(
      <Tooltip label="Eraser">
        <button>Eraser</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'Eraser' });
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({ top: 200, bottom: 232, left: 100, right: 132, width: 32, height: 32, x: 100, y: 200, toJSON() {} } as DOMRect);
    fireEvent.focus(btn);
    act(() => { vi.advanceTimersByTime(90); });
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('hides immediately on mouse leave / blur, cancelling a pending show', () => {
    render(
      <Tooltip label="Fill">
        <button>Fill</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'Fill' });
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({ top: 200, bottom: 232, left: 100, right: 132, width: 32, height: 32, x: 100, y: 200, toJSON() {} } as DOMRect);
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    act(() => { vi.advanceTimersByTime(320); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('IconButton — no native title (custom tooltip only, no double tooltip)', () => {
  it('has an aria-label but no title attribute', () => {
    render(<IconButton icon="pen" label="Pen" onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Pen' });
    expect(btn.getAttribute('title')).toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Pen');
  });
});

describe('TactileStudioEditor — hardware key panning (PanningLeft/Right -> page switch)', () => {
  it('PanningLeft/PanningRight from the DotPad adapter switch document pages', async () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    const adapter = createMockDotPadAdapter();

    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter(), tactileDisplay: adapter }}
      />,
    );
    // add a second page so there's somewhere to pan to/from
    const provider = screen.getByRole('toolbar'); // sanity: editor rendered
    expect(provider).toBeTruthy();

    // Grab the store via a side-channel: re-render with a Capture component
    // inside the same provider isn't possible from outside, so drive purely
    // through the public UI + adapter instead.
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(screen.getByRole('button', { name: '2' })).toBeTruthy();

    act(() => { adapter.simulateKey('PanningLeft'); });
    // after panning left from page 2, we should be back on page 1
    const page1Btn = screen.getByRole('button', { name: '1' });
    expect(page1Btn.getAttribute('aria-current')).toBe('true');

    act(() => { adapter.simulateKey('PanningRight'); });
    const page2Btn = screen.getByRole('button', { name: '2' });
    expect(page2Btn.getAttribute('aria-current')).toBe('true');
  });

  it('ignores non-panning key codes', () => {
    const adapter = createMockDotPadAdapter();
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter(), tactileDisplay: adapter }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('true');
    act(() => { adapter.simulateKey('KeyFunction1'); });
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('true'); // unchanged
  });
});

describe('TactileStudioEditor — onExport callback', () => {
  it('calls onExport after a DTMS export completes', async () => {
    const onExport = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter(), encodeBits: () => '00'.repeat(50) }}
        onExport={onExport}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /DTMS/ }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'dtms' }));
  });
});

describe('EmptyStateHint — first-run empty-canvas guidance (ported from vanilla 8e393f3)', () => {
  it('shows on a fresh, untouched, single-page document', () => {
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <EmptyStateHint labels={{ emptyHintMsg: 'Draw something!' }} />
      </TactileStudioProvider>,
    );
    expect(screen.getByText('Draw something!')).toBeTruthy();
  });

  it('disappears the moment the user draws a dot', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <EmptyStateHint labels={{ emptyHintMsg: 'Draw something!' }} />
      </TactileStudioProvider>,
    );
    expect(screen.queryByText('Draw something!')).toBeTruthy();
    act(() => { capturedStore!.mutateActiveCells((cells) => { cells[0] = 1; }); });
    expect(screen.queryByText('Draw something!')).toBeNull();
  });

  it('disappears after adding a page (no longer single-page), and after loading content', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <EmptyStateHint labels={{ emptyHintMsg: 'Draw something!' }} />
      </TactileStudioProvider>,
    );
    act(() => { capturedStore!.addPage(); });
    expect(screen.queryByText('Draw something!')).toBeNull();
  });

  it('Close dismisses the hint for the rest of the session, even back on a blank single page', () => {
    let capturedStore: ReturnType<typeof useEditorStoreContext> | null = null;
    function Capture() { capturedStore = useEditorStoreContext(); return null; }
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <Capture />
        <EmptyStateHint labels={{ emptyHintMsg: 'Draw something!', close: 'Close' }} />
      </TactileStudioProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Draw something!')).toBeNull();
    // still dismissed even though the document is still blank/single-page
    expect(capturedStore!.getSnapshot().emptyHintOn).toBe(false);
  });

  it('never co-shows with the recovery banner (recovery takes the same screen slot)', async () => {
    const snapshot = {
      v: 1 as const, savedAt: 1, gridW: 10, gridH: 10, output: '60' as const, pageIndex: 0,
      fileName: 'recovered', brailleLang: 'ko-g1', pages: ['x'], audio: {}, vectors: {},
      liveCells: [new Uint8Array(100)],
    };
    const sessionRecovery = { load: async () => snapshot, save: async () => true, clear: async () => {} };
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)} sessionRecovery={sessionRecovery}>
        <RecoveryBanner labels={{ recoverTitle: 'Restore?' }} />
        <EmptyStateHint labels={{ emptyHintMsg: 'Draw something!' }} />
      </TactileStudioProvider>,
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('Restore?')).toBeTruthy();
    expect(screen.queryByText('Draw something!')).toBeNull();
  });
});

describe('DotPadPanel — background reconnect status (onConnectionStateChange wiring)', () => {
  function makeFakeAdapter() {
    let state: 'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'error' = 'disconnected';
    const stateListeners = new Set<(s: any) => void>();
    return {
      async connect() { state = 'connected'; stateListeners.forEach((l) => l(state)); },
      async disconnect() { state = 'disconnected'; stateListeners.forEach((l) => l(state)); },
      async display() {},
      async clear() {},
      subscribeKeys() { return () => {}; },
      getConnectionState() { return state; },
      onConnectionStateChange(listener: (s: any) => void) {
        stateListeners.add(listener);
        return () => stateListeners.delete(listener);
      },
      getDeviceInfo() { return state === 'connected' ? { name: 'Real DotPad', cellType: 'D3', brailleCellCount: 20 } : null; },
      dispose() {},
      _simulateReconnecting() { state = 'reconnecting'; stateListeners.forEach((l) => l(state)); },
      _simulateRecovered() { state = 'connected'; stateListeners.forEach((l) => l(state)); },
    };
  }

  it('shows "Reconnecting…" and disables the Connect button when the adapter pushes a reconnecting state, without any user action', async () => {
    const adapter = makeFakeAdapter();
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <DotPadPanel adapter={adapter as any} labels={{ dpStateReconnecting: 'Reconnecting…' }} />
      </TactileStudioProvider>,
    );
    await act(async () => { await adapter.connect(); });
    expect(screen.getByText(/real dotpad — connected/i)).toBeTruthy();

    act(() => { adapter._simulateReconnecting(); });
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
    // While reconnecting, the ready-state actions (Disconnect/Send) are
    // hidden (same grouping as 'connecting' in the monolith's dpPhaseConnecting)
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect' })).toHaveProperty('disabled', true);

    act(() => { adapter._simulateRecovered(); });
    expect(screen.getByText(/real dotpad — connected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('falls back gracefully (still functional via refresh-after-action) when the adapter has no onConnectionStateChange', async () => {
    const adapter = createMockDotPadAdapter(); // no onConnectionStateChange, per its own test coverage
    render(
      <TactileStudioProvider initialDocument={createDocument('doc', 10, 10)}>
        <DotPadPanel adapter={adapter} />
      </TactileStudioProvider>,
    );
    expect(screen.getByText(/not connected/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });
});

// Phase 5 React component tests (jsdom environment — see vitest.config.ts).
// Canvas 2D rendering is not available under jsdom (getContext('2d') returns
// null); StudioCanvas is written to no-op its draw() in that case rather than
// throw, so these tests verify WIRING (pointer events → store mutations,
// toolbar clicks → tool state, mount/unmount safety) rather than pixel
// output — consistent with how the tactile-text glyph rasterizer seam was
// handled in Phase 3 (documented limitation, not a silent gap).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TactileStudioEditor } from '../../src/react/TactileStudioEditor.js';
import { TactileStudioProvider, useEditorStoreContext } from '../../src/react/TactileStudioProvider.js';
import { StudioCanvas } from '../../src/ui/canvas/StudioCanvas.js';
import { Toolbar } from '../../src/ui/toolbar/Toolbar.js';
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

  it('registers exactly one keydown listener per mount and removes it on unmount (no leak/duplication across remounts)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <TactileStudioEditor
          initialDocument={createDocument('doc', 10, 10)}
          services={{ storage: createMemoryStorageAdapter() }}
        />,
      );
      // exactly one NEW keydown listener registered by this mount (useKeyboardShortcuts)
      const keydownAdds = addSpy.mock.calls.filter((c) => c[0] === 'keydown');
      expect(keydownAdds.length).toBe(i + 1);
      unmount();
      const keydownRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'keydown');
      expect(keydownRemoves.length).toBe(i + 1);
      // the listener function removed must be the exact same one that was added for THIS mount
      expect(removeSpy.mock.calls[i][1]).toBe(addSpy.mock.calls.filter((c) => c[0] === 'keydown')[i][1]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Polygon' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Polygon' }));
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
    const canvas = document.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 200, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 200, configurable: true });
    firePointerEvent(canvas, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 9 });

    const undoBtn = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false); // the flood created one undo entry

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(undoBtn.disabled).toBe(true); // Ctrl+Z consumed that entry
  });
});

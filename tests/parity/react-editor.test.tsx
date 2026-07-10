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

  it('does not register duplicate DOM listeners across repeated mount/unmount cycles', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <TactileStudioEditor
          initialDocument={createDocument('doc', 10, 10)}
          services={{ storage: createMemoryStorageAdapter() }}
        />,
      );
      unmount();
    }
    // TactileStudioEditor itself registers no document-level listeners in
    // this pass (StudioCanvas uses only React's own pointer-event props) —
    // this test pins that invariant so a future change that adds one is
    // forced to also add matching cleanup.
    expect(addSpy).not.toHaveBeenCalled();
    addSpy.mockRestore();
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

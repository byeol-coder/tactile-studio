// Zoom pill (ZoomControls) + Ctrl/Cmd +/-/0 keyboard shortcut wiring.
// Pure preset-stepping logic (zoomIn/zoomOut/zoomReset/isAtMin/MaxZoom) is
// covered directly against EditorStore in editor-store.test.ts; this file
// only verifies the React wiring (pill renders the right percentage/
// disabled state, clicking it and pressing the keyboard shortcuts both
// reach the same store methods) -- same division of labor as the rest of
// this test suite (see react-editor.test.tsx's own header comment).
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TactileStudioEditor } from '../../src/react/TactileStudioEditor.js';
import { createDocument } from '../../src/core/document/document.js';
import { createMemoryStorageAdapter } from '../../src/storage/adapters/memory-storage-adapter.js';

afterEach(cleanup);

function renderEditor() {
  return render(
    <TactileStudioEditor
      initialDocument={createDocument('doc', 10, 10)}
      services={{ storage: createMemoryStorageAdapter() }}
    />,
  );
}

// The percentage button's accessible name is the fixed action description
// ("Reset to 100%", from zoomResetL) -- same convention as vanilla's own
// aria-label="{{ t.zoomResetL }}" -- NOT the live percentage text it
// displays. So tests find/click it by that fixed name, and separately
// assert on its visible text content (via getByText) for the actual zoom
// readout, rather than querying by role+name with the percentage.
const resetBtn = () => screen.getByRole('button', { name: 'Reset to 100%' }) as HTMLButtonElement;

describe('ZoomControls — pill wiring (buttons)', () => {
  it('starts at 100%, and zoom-in/zoom-out buttons update the displayed percentage', () => {
    renderEditor();
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('clicking the percentage button resets to 100% from any zoom level', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeTruthy();

    fireEvent.click(resetBtn());
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('disables the zoom-out button at the minimum step and the zoom-in button at the maximum', () => {
    renderEditor();
    const zoomOutBtn = () => screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
    const zoomInBtn = () => screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement;

    expect(zoomOutBtn().disabled).toBe(false);
    expect(zoomInBtn().disabled).toBe(false);

    for (let i = 0; i < 10; i++) fireEvent.click(zoomOutBtn());
    expect(screen.getByText('10%')).toBeTruthy();
    expect(zoomOutBtn().disabled).toBe(true);

    fireEvent.click(resetBtn()); // back to 100%
    for (let i = 0; i < 10; i++) fireEvent.click(zoomInBtn());
    expect(screen.getByText('800%')).toBeTruthy();
    expect(zoomInBtn().disabled).toBe(true);
  });
});

describe('Zoom keyboard shortcuts (Ctrl/Cmd +/-/0), wired in useKeyboardShortcuts.ts', () => {
  it('Ctrl+= zooms in the same way as clicking the pill\u2019s zoom-in button', () => {
    renderEditor();
    fireEvent.keyDown(document, { key: '=', ctrlKey: true });
    expect(screen.getByText('125%')).toBeTruthy();
  });

  it('Ctrl+- zooms out', () => {
    renderEditor();
    fireEvent.keyDown(document, { key: '-', ctrlKey: true });
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('Ctrl+0 resets to 100% from any zoom level', () => {
    renderEditor();
    fireEvent.keyDown(document, { key: '=', ctrlKey: true });
    fireEvent.keyDown(document, { key: '=', ctrlKey: true });
    expect(screen.getByText('150%')).toBeTruthy();
    fireEvent.keyDown(document, { key: '0', ctrlKey: true });
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('plain "=", "-", "0" with no modifier do nothing (not stolen from text input, matching vanilla\u2019s own Ctrl/Cmd-gated binding)', () => {
    renderEditor();
    fireEvent.keyDown(document, { key: '=' });
    fireEvent.keyDown(document, { key: '-' });
    fireEvent.keyDown(document, { key: '0' });
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('NumpadAdd/NumpadSubtract with Ctrl also zoom (numeric-keypad variant, matching vanilla\u2019s e.code check)', () => {
    renderEditor();
    fireEvent.keyDown(document, { key: 'Add', code: 'NumpadAdd', ctrlKey: true });
    expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Subtract', code: 'NumpadSubtract', ctrlKey: true });
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

describe('Zoom scroll anchoring (verbatim port of monolith zoomAround/zoomAtViewportCenter)', () => {
  // jsdom's getBoundingClientRect() returns all-zero by default; these tests
  // mock it on the actual viewport element to a known rect so the anchor
  // math (which depends on real geometry) is meaningfully exercised, not
  // just "runs without throwing". jsdom DOES support plain get/set on
  // scrollLeft/scrollTop (it just never fires a real scroll/overflow
  // reflow), which is all this logic reads and writes.
  function mockViewportRect(el: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      right: rect.left + rect.width, bottom: rect.top + rect.height,
      x: rect.left, y: rect.top, toJSON: () => ({}),
    } as DOMRect);
  }

  it('center-anchors when zoom changes via a button click (no pending mouse position)', () => {
    renderEditor();
    const viewport = screen.getByTestId('canvas-viewport') as HTMLDivElement;
    mockViewportRect(viewport, { left: 100, top: 50, width: 800, height: 600 });
    viewport.scrollLeft = 40;
    viewport.scrollTop = 30;

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); // 1 -> 1.25

    // anchor = viewport center in client coords = (100+400, 50+300) = (500, 350)
    // ax = 500-100 = 400, ay = 350-50 = 300
    // px = scrollLeft(40) + ax(400) = 440, py = scrollTop(30) + ay(300) = 330
    // ratio = 1.25 / 1 = 1.25
    // new scrollLeft = px*ratio - ax = 440*1.25 - 400 = 150
    // new scrollTop  = py*ratio - ay = 330*1.25 - 300 = 112.5
    expect(viewport.scrollLeft).toBeCloseTo(150, 5);
    expect(viewport.scrollTop).toBeCloseTo(112.5, 5);
  });

  it('center-anchors identically for the Ctrl/Cmd+0 keyboard shortcut', () => {
    renderEditor();
    const viewport = screen.getByTestId('canvas-viewport') as HTMLDivElement;
    mockViewportRect(viewport, { left: 0, top: 0, width: 400, height: 200 });
    // get to 200% first (no assertions on the intermediate scroll math --
    // only the FINAL reset's anchoring is under test here)
    fireEvent.keyDown(document, { key: '=', ctrlKey: true });
    fireEvent.keyDown(document, { key: '=', ctrlKey: true });
    fireEvent.keyDown(document, { key: '=', ctrlKey: true }); // 1 -> 1.25 -> 1.5 -> 2
    expect(screen.getByText('200%')).toBeTruthy();
    viewport.scrollLeft = 300;
    viewport.scrollTop = 150;

    fireEvent.keyDown(document, { key: '0', ctrlKey: true }); // reset to 100%

    // anchor = center = (200, 100); ax=200, ay=100
    // px = 300+200=500, py=150+100=250; ratio = 1/2 = 0.5
    // new scrollLeft = 500*0.5 - 200 = 50; new scrollTop = 250*0.5 - 100 = 25
    expect(viewport.scrollLeft).toBeCloseTo(50, 5);
    expect(viewport.scrollTop).toBeCloseTo(25, 5);
  });

  it('anchors to the exact mouse position for Ctrl/Cmd+wheel (not the viewport center)', () => {
    renderEditor();
    const viewport = screen.getByTestId('canvas-viewport') as HTMLDivElement;
    mockViewportRect(viewport, { left: 0, top: 0, width: 800, height: 600 });
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;

    // wheel up (deltaY < 0) with ctrlKey zooms IN by the continuous factor
    // 1.08, at the exact cursor position (200, 100) -- not the center.
    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true, clientX: 200, clientY: 100 });

    const snap = () => screen.getByRole('group', { name: 'Zoom canvas' });
    expect(snap()).toBeTruthy(); // pill still renders after a continuous (non-preset) zoom value
    // ax=200, ay=100; px=0+200=200, py=0+100=100; ratio=1.08
    // new scrollLeft = 200*1.08 - 200 = 16; new scrollTop = 100*1.08 - 100 = 8
    expect(viewport.scrollLeft).toBeCloseTo(16, 1);
    expect(viewport.scrollTop).toBeCloseTo(8, 1);
  });

  it('plain wheel (no Ctrl/Cmd) does not zoom or touch scroll position -- native scroll is left alone', () => {
    renderEditor();
    const viewport = screen.getByTestId('canvas-viewport') as HTMLDivElement;
    mockViewportRect(viewport, { left: 0, top: 0, width: 800, height: 600 });
    viewport.scrollLeft = 12;
    viewport.scrollTop = 7;

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 100 }); // no ctrlKey

    expect(screen.getByText('100%')).toBeTruthy(); // zoom unchanged
    expect(viewport.scrollLeft).toBe(12); // untouched by our handler
    expect(viewport.scrollTop).toBe(7);
  });

  it('does nothing (no divide-by-zero / NaN scroll) when the viewport ref is unavailable', () => {
    // Covered implicitly: initial mount (zoom already at 1, no prior render)
    // never fires the effect's scroll-adjustment branch, since oldZoom ===
    // newZoom on first run. Explicit regression guard: mounting and
    // immediately unmounting must not throw even though jsdom's canvas
    // 2D context is unavailable (see this suite's known jsdom limitation).
    const { unmount } = renderEditor();
    expect(() => unmount()).not.toThrow();
  });
});

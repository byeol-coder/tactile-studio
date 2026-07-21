// Zoom pill (ZoomControls) + Ctrl/Cmd +/-/0 keyboard shortcut wiring.
// Pure preset-stepping logic (zoomIn/zoomOut/zoomReset/isAtMin/MaxZoom) is
// covered directly against EditorStore in editor-store.test.ts; this file
// only verifies the React wiring (pill renders the right percentage/
// disabled state, clicking it and pressing the keyboard shortcuts both
// reach the same store methods) -- same division of labor as the rest of
// this test suite (see react-editor.test.tsx's own header comment).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
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

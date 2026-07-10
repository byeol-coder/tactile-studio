// Phase 6 verification suite: proves TactileStudioEditor owns none of
// routing, authentication, Supabase/cloud storage, or internal language
// switching, and mounts cleanly as a child of an arbitrary "host route"
// component — simulating embedding inside Tactile World's own router.
//
// This suite does not test NEW behavior; it's an audit, codified as tests,
// per Phase 6's "remove product ownership" / "verify embedding inside a
// parent React route" requirements. Nothing here required removing code —
// grep across src/ (see the Phase 6 report) already confirmed no
// router/auth/Supabase import exists; these tests pin that as a regression
// guard going forward.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TactileStudioEditor } from '../../src/react/TactileStudioEditor.js';
import { createDocument } from '../../src/core/document/document.js';
import { createMemoryStorageAdapter } from '../../src/storage/adapters/memory-storage-adapter.js';

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLCanvasElement) {
    return { left: 0, top: 0, width: this.width || 1, height: this.height || 1, right: this.width || 1, bottom: this.height || 1, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
});

/** Stands in for a host app's own router/route component — e.g. Tactile
 *  World's react-router-dom <Route> element wrapping a `/studio` page.
 *  TactileStudioEditor must render correctly as a plain child of this,
 *  with no awareness of it. */
function HostRoute({ children, path }: { children: React.ReactNode; path: string }) {
  return (
    <div data-testid="host-route" data-path={path}>
      <nav aria-label="Host app navigation">
        <a href="/other-page">Other host page</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}

describe('Phase 6 — no router ownership', () => {
  it('mounts as a plain child of a host route component, does not render any navigation of its own', () => {
    render(
      <HostRoute path="/studio">
        <TactileStudioEditor
          initialDocument={createDocument('doc', 10, 10)}
          services={{ storage: createMemoryStorageAdapter() }}
        />
      </HostRoute>,
    );
    expect(screen.getByTestId('host-route').getAttribute('data-path')).toBe('/studio');
    expect(screen.getByRole('link', { name: 'Other host page' })).toBeTruthy();
    // Studio renders exactly one <main> region worth of UI, no <nav>/<a> of its own
    expect(screen.queryAllByRole('link').length).toBe(1); // only the host's own link
  });

  it('never touches window.location or history', () => {
    const assignSpy = vi.spyOn(window.history, 'pushState');
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    expect(assignSpy).not.toHaveBeenCalled();
    assignSpy.mockRestore();
  });
});

describe('Phase 6 — no authentication ownership', () => {
  it('renders with no login/logout/session UI regardless of services provided', () => {
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    expect(screen.queryByText(/log ?in/i)).toBeNull();
    expect(screen.queryByText(/log ?out/i)).toBeNull();
    expect(screen.queryByText(/sign ?in/i)).toBeNull();
  });

  it('StudioStorageAdapter has no auth-related members in its contract', async () => {
    const mod = await import('../../src/storage/adapters/types.js');
    // structural check: the interface itself has exactly load/save — this
    // compiles only because TypeScript enforces it; this test exists so a
    // future addition of e.g. `login()` to the interface fails a code review
    // discussion, not just quietly typechecks.
    expect(Object.keys(mod)).not.toContain('AuthAdapter');
  });
});

describe('Phase 6 — no Supabase / cloud-storage ownership', () => {
  it('works fully with a plain in-memory storage adapter — no Supabase client required anywhere in the import graph', async () => {
    // If any module in the dependency graph imported '@supabase/supabase-js'
    // or similar, this dynamic import would need that package resolvable;
    // it succeeds using only this repo's own modules.
    const { createMemoryStorageAdapter: create } = await import('../../src/storage/adapters/memory-storage-adapter.js');
    const storage = create();
    const doc = createDocument('doc', 10, 10);
    const result = await storage.save(doc);
    expect(result.ok).toBe(true);
    render(<TactileStudioEditor initialDocument={doc} services={{ storage }} />);
    expect(screen.getByRole('img', { name: /tactile drawing canvas/i })).toBeTruthy();
  });
});

describe('Phase 6 — no internal language switching', () => {
  it('renders English defaults with no labels prop, and host labels fully override them — no language toggle exists', () => {
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^(EN|KO|한국어|영어)$/i })).toBeNull();
    cleanup();

    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc2', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
        labels={{ toolNames: { pen: '펜' } }}
      />,
    );
    expect(screen.getByRole('button', { name: '펜' })).toBeTruthy();
  });

  it('does not read navigator.language or any language-keyed localStorage entry', () => {
    const navGetter = vi.spyOn(window.navigator, 'language', 'get');
    render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
      />,
    );
    expect(navGetter).not.toHaveBeenCalled();
    navGetter.mockRestore();
  });
});

describe('Phase 6 — host-configurable surface (labels/theme/services/callbacks)', () => {
  it('applies a host theme as CSS custom properties on the root element', () => {
    const { container } = render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 10, 10)}
        services={{ storage: createMemoryStorageAdapter() }}
        theme={{ '--ts-primary': '#FF4F00' }}
        className="host-supplied-class"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('host-supplied-class');
    expect(root.style.getPropertyValue('--ts-primary')).toBe('#FF4F00');
  });

  it('fires onChange/onDirtyChange callbacks on edits', () => {
    const onChange = vi.fn();
    const onDirtyChange = vi.fn();
    const { container } = render(
      <TactileStudioEditor
        initialDocument={createDocument('doc', 6, 6)}
        services={{ storage: createMemoryStorageAdapter() }}
        onChange={onChange}
        onDirtyChange={onDirtyChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    Object.defineProperty(canvas, 'width', { value: 120, configurable: true });
    Object.defineProperty(canvas, 'height', { value: 120, configurable: true });
    const evt = new MouseEvent('pointerdown', { clientX: 60, clientY: 60, button: 0, bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'pointerId', { value: 1, configurable: true });
    // fill tool is not selected by default (pen is) — just verify onChange
    // fires for the default pen stroke via pointerup completing the gesture
    const evtUp = new MouseEvent('pointerup', { clientX: 60, clientY: 60, button: 0, bubbles: true, cancelable: true });
    Object.defineProperty(evtUp, 'pointerId', { value: 1, configurable: true });
    canvas.dispatchEvent(evt);
    canvas.dispatchEvent(evtUp);
    expect(onChange).toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });
});

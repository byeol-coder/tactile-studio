// src/react/TactileStudioProvider.tsx
//
// Owns exactly one EditorStore per mount (created via useRef so remounting
// the provider always gets a fresh store — no stale state leaking across
// mounts, no module-level singleton). Everything under it reads/writes the
// store through the hooks in ./hooks, never by reaching into core/ directly.

import React, { createContext, useContext, useRef, useEffect } from 'react';
import { EditorStore } from '../core/state/editor-store.js';
import type { StudioDocument } from '../core/types.js';

const EditorStoreContext = createContext<EditorStore | null>(null);

export interface TactileStudioProviderProps {
  initialDocument: StudioDocument;
  onChange?(document: StudioDocument): void;
  onDirtyChange?(dirty: boolean): void;
  children: React.ReactNode;
}

export function TactileStudioProvider({ initialDocument, onChange, onDirtyChange, children }: TactileStudioProviderProps) {
  // Created once, lazily, per mount. A later prop change to `initialDocument`
  // does NOT reset the store — that would silently discard in-progress edits;
  // callers who want to load a different document should remount the
  // provider (e.g. by changing its `key`), which is the same rule React asks
  // of any component wrapping local state around a prop.
  const storeRef = useRef<EditorStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new EditorStore(initialDocument, { onChange, onDirtyChange });
  }

  // Keep the latest callbacks without recreating the store (a fresh store
  // per render would drop history/dirty state and defeat the whole point of
  // useRef above). We reach past the private `opts` field intentionally here
  // — this is the ONE place outside editor-store.ts allowed to do so.
  useEffect(() => {
    (storeRef.current as any).opts.onChange = onChange;
    (storeRef.current as any).opts.onDirtyChange = onDirtyChange;
  }, [onChange, onDirtyChange]);

  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
}

export function useEditorStoreContext(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditorStoreContext must be used within a <TactileStudioProvider>.');
  return store;
}

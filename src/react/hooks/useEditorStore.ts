// src/react/hooks/useEditorStore.ts
//
// The one hook that subscribes a component to store snapshots. Every other
// hook (useTool, useHistory, usePages, …) is a thin, memoized slice of this
// one — none of them re-implement the subscription.

import { useSyncExternalStore } from 'react';
import { useEditorStoreContext } from '../TactileStudioProvider.js';
import type { EditorSnapshot } from '../../core/state/types.js';
import type { EditorStore } from '../../core/state/editor-store.js';

export function useEditorStore(): { snapshot: EditorSnapshot; store: EditorStore } {
  const store = useEditorStoreContext();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { snapshot, store };
}

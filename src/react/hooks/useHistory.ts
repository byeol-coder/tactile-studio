// src/react/hooks/useHistory.ts
import { useEditorStore } from './useEditorStore.js';

export function useHistory(): { canUndo: boolean; canRedo: boolean; undo(): void; redo(): void } {
  const { snapshot, store } = useEditorStore();
  return {
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    undo: () => { store.undo(); },
    redo: () => { store.redo(); },
  };
}

// src/react/hooks/usePages.ts
import { useEditorStore } from './useEditorStore.js';

export function usePages(): {
  pageIndex: number;
  pageCount: number;
  addPage(): void;
  duplicatePage(idx: number): boolean;
  deletePageAt(idx: number): boolean;
  movePage(from: number, to: number): boolean;
} {
  const { snapshot, store } = useEditorStore();
  return {
    pageIndex: snapshot.pageIndex,
    pageCount: snapshot.pageCount,
    addPage: () => store.addPage(),
    duplicatePage: (idx: number) => store.duplicatePage(idx),
    deletePageAt: (idx: number) => store.deletePageAt(idx),
    movePage: (from: number, to: number) => store.movePage(from, to),
  };
}

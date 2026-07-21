// src/react/hooks/useZoom.ts
//
// Thin React wrapper around EditorStore's zoom preset methods (zoomIn/
// zoomOut/zoomReset), same pattern as useTool.ts. canZoomIn/canZoomOut are
// derived here (not stored) so they always reflect the current snapshot's
// zoom value without an extra store field.

import { useEditorStore } from './useEditorStore.js';

export function useZoom(): {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
} {
  const { snapshot, store } = useEditorStore();
  return {
    zoom: snapshot.zoom,
    canZoomIn: !store.isAtMaxZoom(),
    canZoomOut: !store.isAtMinZoom(),
    zoomIn: store.zoomIn.bind(store),
    zoomOut: store.zoomOut.bind(store),
    zoomReset: store.zoomReset.bind(store),
  };
}

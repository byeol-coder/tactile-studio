// src/react/hooks/useTool.ts
import { useEditorStore } from './useEditorStore.js';
import type { ToolId } from '../../core/state/types.js';

export function useTool(): { tool: ToolId; strokeSize: number; eraserSize: number; setTool(t: ToolId): void; setStrokeSize(n: number): void; setEraserSize(n: number): void } {
  const { snapshot, store } = useEditorStore();
  return {
    tool: snapshot.tool,
    strokeSize: snapshot.strokeSize,
    eraserSize: snapshot.eraserSize,
    setTool: store.setTool.bind(store),
    setStrokeSize: store.setStrokeSize.bind(store),
    setEraserSize: store.setEraserSize.bind(store),
  };
}

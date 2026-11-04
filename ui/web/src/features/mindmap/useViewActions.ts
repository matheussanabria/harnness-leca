// Zoom, fit and center actions for the floating toolbar. Must be called inside a ReactFlowProvider.
import { useReactFlow } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "./layout.ts";

export interface ViewActions {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  center(): void;
  canCenter: boolean;
}

/** `selected` is the rendered top-left position of the selected node, or null when nothing is selected. */
export function useViewActions(selected: { x: number; y: number } | null): ViewActions {
  const flow = useReactFlow();
  return {
    zoomIn: () => void flow.zoomIn({ duration: 200 }),
    zoomOut: () => void flow.zoomOut({ duration: 200 }),
    fit: () => void flow.fitView({ padding: 0.3, maxZoom: 1, duration: 250 }),
    center: () => {
      if (!selected) return;
      void flow.setCenter(selected.x + NODE_WIDTH / 2, selected.y + NODE_HEIGHT / 2, {
        zoom: flow.getViewport().zoom,
        duration: 250,
      });
    },
    canCenter: selected !== null,
  };
}

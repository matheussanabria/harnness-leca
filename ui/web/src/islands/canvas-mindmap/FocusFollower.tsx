// Keeps the selected node visible without changing the zoom. The map is framed once by ReactFlow's own `fitView`.
import { useReactFlow, useStore } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { NODE_HEIGHT, NODE_WIDTH } from "../../features/mindmap/layout.ts";
import type { MindFlowNode } from "./MindNodeView.tsx";

/** Screen-space margin that still counts as comfortably inside the viewport. */
const COMFORT_MARGIN = 32;

/**
 * Positions come from the layout (props), not from React Flow's internal nodes: the canvas rebuilds its node
 * objects on every render, which keeps `useNodesInitialized()` false forever.
 */
export function FocusFollower({ selectedId, nodes }: { selectedId: string; nodes: MindFlowNode[] }) {
  const flow = useReactFlow();
  const width = useStore((store) => store.width);
  const height = useStore((store) => store.height);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const first = useRef(true);

  useEffect(() => {
    if (width === 0 || height === 0) return;
    if (first.current) {
      first.current = false; // the initial `fitView` frames the whole map
      return;
    }
    const node = nodesRef.current.find((item) => item.id === selectedId);
    if (!node) return;
    const viewport = flow.getViewport();
    const left = node.position.x * viewport.zoom + viewport.x;
    const top = node.position.y * viewport.zoom + viewport.y;
    const inside =
      left >= COMFORT_MARGIN &&
      top >= COMFORT_MARGIN &&
      left + NODE_WIDTH * viewport.zoom <= width - COMFORT_MARGIN &&
      top + NODE_HEIGHT * viewport.zoom <= height - COMFORT_MARGIN;
    if (inside) return;
    // Pan only: the current zoom is preserved, so following the focus never zooms out.
    void flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
      zoom: viewport.zoom,
      duration: 200,
    });
  }, [selectedId, flow, width, height]);

  return null;
}

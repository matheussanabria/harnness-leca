// Shift+drag reparenting. React Flow reports the drag; the pure `findDropTarget` decides which node is a valid target,
// so the highlight and the drop always agree. A plain drag (no Shift) is not handled here.
import type { Edge, ReactFlowInstance } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import { findDropTarget, type NodeRect } from "../../features/mindmap/dropTarget.ts";
import { NODE_HEIGHT, NODE_WIDTH } from "../../features/mindmap/layout.ts";
import type { MindDoc } from "../../features/mindmap/types.ts";
import type { MindFlowNode } from "./MindNodeView.tsx";

type MindFlow = ReactFlowInstance<MindFlowNode, Edge>;

interface DragNode {
  id: string;
}

/** React Flow reports drags as DOM mouse or touch events. */
type DragEvent = MouseEvent | TouchEvent;

function pointerOf(event: DragEvent): { x: number; y: number } {
  const source = "changedTouches" in event ? (event.changedTouches[0] ?? event.touches[0]) : event;
  return { x: source?.clientX ?? 0, y: source?.clientY ?? 0 };
}

export function useReparentDrag(doc: MindDoc, reparentNode: (id: string, targetId: string) => void) {
  const instance = useRef<MindFlow | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  /** The id being dragged while a Shift drag is running, null otherwise. The mode is fixed at drag start. */
  const dragging = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const targetUnder = useCallback((event: DragEvent, draggedId: string): string | null => {
    const flow = instance.current;
    if (!flow) return null;
    const point = flow.screenToFlowPosition(pointerOf(event));
    const rects = new Map<string, NodeRect>();
    for (const node of flow.getNodes()) {
      rects.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width ?? NODE_WIDTH,
        height: node.measured?.height ?? NODE_HEIGHT,
      });
    }
    return findDropTarget(docRef.current, draggedId, rects, point);
  }, []);

  return {
    /** Pass to ReactFlow `onInit`. */
    onInit: useCallback((flow: MindFlow) => {
      instance.current = flow;
    }, []),
    dropTargetId,
    onDragStart: useCallback((event: DragEvent, node: DragNode) => {
      // The root has nowhere to go: its Shift drag stays a plain move.
      dragging.current = event.shiftKey && node.id !== docRef.current.rootId ? node.id : null;
    }, []),
    onDrag: useCallback(
      (event: DragEvent, node: DragNode) => {
        if (dragging.current === null) return;
        const next = targetUnder(event, node.id);
        setDropTargetId((current) => (current === next ? current : next));
      },
      [targetUnder],
    ),
    /** Returns true when the drop was a reparent drag (handled here, with or without a target). */
    onDragStop: useCallback(
      (event: DragEvent, node: DragNode): boolean => {
        if (dragging.current === null) return false;
        dragging.current = null;
        const target = targetUnder(event, node.id);
        setDropTargetId(null);
        if (target) reparentNode(node.id, target);
        return true;
      },
      [targetUnder, reparentNode],
    ),
  };
}

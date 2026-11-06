// Pure helper: find a valid drop target under a point. Never mutates anything.
import { isInSubtree, parentOf } from "./tree.ts";
import type { MindDoc } from "./types.ts";

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Find the valid drop target under a point.
 * @param doc - The mind map document
 * @param draggedId - Id of the node being dragged
 * @param rects - Map of node id to its bounding rect in flow coordinates
 * @param point - Point to test in flow coordinates
 * @returns The id of the valid target, or null if none
 */
export function findDropTarget(
  doc: MindDoc,
  draggedId: string,
  rects: ReadonlyMap<string, NodeRect>,
  point: { x: number; y: number },
): string | null {
  const draggedNode = doc.nodes[draggedId];
  if (!draggedNode) return null;

  // Find all rects that contain the point
  const candidates: { id: string; area: number; order: number }[] = [];
  let order = 0;
  for (const [id, rect] of rects) {
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
      candidates.push({ id, area: rect.width * rect.height, order });
    }
    order += 1;
  }

  if (candidates.length === 0) return null;

  // Smallest area first (the innermost node wins); equal areas go to the later entry.
  candidates.sort((a, b) => a.area - b.area || b.order - a.order);

  for (const candidate of candidates) {
    // Skip the dragged node itself
    if (candidate.id === draggedId) continue;

    // Skip descendants of the dragged node (would create a cycle)
    if (isInSubtree(doc, draggedId, candidate.id)) continue;

    // Skip the current parent (dropping on current parent does nothing)
    const currentParent = parentOf(doc, draggedId);
    if (candidate.id === currentParent) continue;

    // Found a valid target
    return candidate.id;
  }

  return null;
}

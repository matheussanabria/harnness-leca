// Tidy horizontal tree layout via d3-hierarchy. Children of collapsed nodes are hidden from the hierarchy.
import { hierarchy, tree } from "d3-hierarchy";
import type { MindDoc, MindNode } from "./types.ts";

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 40;
const GAP_X = 70;
const GAP_Y = 16;

export interface Placed {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  hasChildren: boolean;
  collapsed: boolean;
}

export function layoutTree(doc: MindDoc): Placed[] {
  const root = hierarchy<MindNode>(doc.nodes[doc.rootId] as MindNode, (node) =>
    node.collapsed ? [] : node.children.map((id) => doc.nodes[id]).filter((child): child is MindNode => !!child),
  );
  // d3 lays out "breadth" along x and "depth" along y; swap them for a left-to-right tree.
  tree<MindNode>().nodeSize([NODE_HEIGHT + GAP_Y, NODE_WIDTH + GAP_X])(root);
  return root.descendants().map((item) => ({
    id: item.data.id,
    parentId: item.parent ? item.parent.data.id : null,
    x: item.y ?? 0,
    y: item.x ?? 0,
    hasChildren: item.data.children.length > 0,
    collapsed: item.data.collapsed,
  }));
}

/** Visible ids in top-to-bottom order, used for arrow-key navigation. */
export function visibleOrder(doc: MindDoc): string[] {
  return layoutTree(doc)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((placed) => placed.id);
}

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
  w: number;
  h: number;
}

export interface Offset {
  dx: number;
  dy: number;
}

const ZERO: Offset = { dx: 0, dy: 0 };

/** Rendered size of a node: its manual size or the default. */
export function sizeOf(node: Pick<MindNode, "w" | "h"> | undefined): { w: number; h: number } {
  return { w: node?.w ?? NODE_WIDTH, h: node?.h ?? NODE_HEIGHT };
}

export function layoutTree(doc: MindDoc): Placed[] {
  const root = hierarchy<MindNode>(doc.nodes[doc.rootId] as MindNode, (node) =>
    node.collapsed ? [] : node.children.map((id) => doc.nodes[id]).filter((child): child is MindNode => !!child),
  );
  // d3 lays out "breadth" along x and "depth" along y; swap them for a left-to-right tree.
  // Sibling spacing follows the node heights; column spacing follows the widest node of each depth.
  tree<MindNode>()
    .nodeSize([NODE_HEIGHT + GAP_Y, NODE_WIDTH + GAP_X])
    .separation((a, b) => {
      const gap = (sizeOf(a.data).h + sizeOf(b.data).h) / 2 + GAP_Y;
      return ((a.parent === b.parent ? 1 : 2) * gap) / (NODE_HEIGHT + GAP_Y);
    })(root);
  const widest: number[] = [];
  for (const item of root.descendants()) {
    widest[item.depth] = Math.max(widest[item.depth] ?? 0, sizeOf(item.data).w);
  }
  const columnX: number[] = [];
  for (let depth = 0; depth < widest.length; depth++) {
    columnX[depth] = depth === 0 ? 0 : (columnX[depth - 1] as number) + (widest[depth - 1] as number) + GAP_X;
  }
  return root.descendants().map((item) => {
    const { w, h } = sizeOf(item.data);
    return {
      id: item.data.id,
      parentId: item.parent ? item.parent.data.id : null,
      x: columnX[item.depth] ?? 0,
      // d3 gives the node centre; keep centres aligned so default-size nodes land where they always did.
      y: (item.x ?? 0) + (NODE_HEIGHT - h) / 2,
      hasChildren: item.data.children.length > 0,
      collapsed: item.data.collapsed,
      w,
      h,
    };
  });
}

/** Visible ids in top-to-bottom order, used for arrow-key navigation. */
export function visibleOrder(doc: MindDoc): string[] {
  return layoutTree(doc)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((placed) => placed.id);
}

/** Accumulated manual offset of every node: its own dx/dy plus all ancestors'. */
export function offsetMap(doc: MindDoc): Map<string, Offset> {
  const parents = new Map<string, string>();
  for (const node of Object.values(doc.nodes)) {
    for (const child of node.children) parents.set(child, node.id);
  }
  const offsets = new Map<string, Offset>();
  const resolve = (id: string): Offset => {
    const cached = offsets.get(id);
    if (cached) return cached;
    const node = doc.nodes[id];
    if (!node) return ZERO;
    const parentId = parents.get(id);
    const parent = parentId ? resolve(parentId) : ZERO;
    const value = { dx: parent.dx + (node.dx ?? 0), dy: parent.dy + (node.dy ?? 0) };
    offsets.set(id, value);
    return value;
  };
  for (const id of Object.keys(doc.nodes)) resolve(id);
  return offsets;
}

/** Accumulated manual offset of one node, ancestors included. */
export function absoluteOffset(doc: MindDoc, id: string): Offset {
  return offsetMap(doc).get(id) ?? ZERO;
}

/** Rendered position: the tidy layout position plus the accumulated manual offset. */
export function renderedPosition(doc: MindDoc, placed: Pick<Placed, "id" | "x" | "y">): { x: number; y: number } {
  const { dx, dy } = absoluteOffset(doc, placed.id);
  return { x: placed.x + dx, y: placed.y + dy };
}

/**
 * Converts a dropped rendered position back into the node's own offset, so the offset stays relative to the tidy
 * layout position plus the ancestors' offsets.
 */
export function offsetFromPosition(doc: MindDoc, id: string, x: number, y: number): Offset {
  const placed = layoutTree(doc).find((item) => item.id === id);
  if (!placed) return ZERO;
  const parent = placed.parentId ? absoluteOffset(doc, placed.parentId) : ZERO;
  return { dx: x - placed.x - parent.dx, dy: y - placed.y - parent.dy };
}

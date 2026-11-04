// Pure, immutable editing commands. A command that cannot apply returns the same doc reference.
import { isInSubtree, parentOf, subtreeIds } from "./tree.ts";
import type { MindDoc, MindNode } from "./types.ts";
import { MAX_NODES, MAX_TEXT } from "./types.ts";

function put(doc: MindDoc, node: MindNode): MindDoc {
  return { ...doc, nodes: { ...doc.nodes, [node.id]: node } };
}

const full = (doc: MindDoc): boolean => Object.keys(doc.nodes).length >= MAX_NODES;

/** Tab: new last child; expands a collapsed parent so the new node is visible. */
export function addChild(doc: MindDoc, parentId: string, newId: string, text = ""): MindDoc {
  const parent = doc.nodes[parentId];
  if (!parent || doc.nodes[newId] || full(doc)) return doc;
  const next = put(doc, { ...parent, children: [...parent.children, newId], collapsed: false });
  return put(next, { id: newId, text, children: [], collapsed: false });
}

/** Enter: new sibling right after the node. The root has no siblings, so it gets a child instead. */
export function addSibling(doc: MindDoc, id: string, newId: string, text = ""): MindDoc {
  const parentId = parentOf(doc, id);
  if (parentId === null) return addChild(doc, id, newId, text);
  const parent = doc.nodes[parentId] as MindNode;
  if (doc.nodes[newId] || full(doc)) return doc;
  const at = parent.children.indexOf(id) + 1;
  const children = [...parent.children.slice(0, at), newId, ...parent.children.slice(at)];
  return put(put(doc, { ...parent, children }), { id: newId, text, children: [], collapsed: false });
}

/**
 * Move `id` under `newParentId` at `index` (default: last). Refuses the root and any move under the node's own
 * descendants (cycle guard).
 */
export function reparent(doc: MindDoc, id: string, newParentId: string, index?: number): MindDoc {
  if (id === doc.rootId || !doc.nodes[id] || !doc.nodes[newParentId]) return doc;
  if (isInSubtree(doc, id, newParentId)) return doc;
  const oldParentId = parentOf(doc, id);
  if (oldParentId === null) return doc;
  const oldParent = doc.nodes[oldParentId] as MindNode;
  const next = put(doc, { ...oldParent, children: oldParent.children.filter((child) => child !== id) });
  const target = next.nodes[newParentId] as MindNode;
  const at = index === undefined ? target.children.length : Math.max(0, Math.min(index, target.children.length));
  const children = [...target.children.slice(0, at), id, ...target.children.slice(at)];
  return put(next, { ...target, children, collapsed: false });
}

/** Shift+Tab: become the next sibling of the current parent. */
export function outdent(doc: MindDoc, id: string): MindDoc {
  const parentId = parentOf(doc, id);
  if (parentId === null) return doc;
  const grandId = parentOf(doc, parentId);
  if (grandId === null) return doc;
  const grand = doc.nodes[grandId] as MindNode;
  return reparent(doc, id, grandId, grand.children.indexOf(parentId) + 1);
}

/** Delete a node and everything below it. The root cannot be deleted. */
export function deleteSubtree(doc: MindDoc, id: string): MindDoc {
  const parentId = parentOf(doc, id);
  if (parentId === null) return doc;
  const doomed = new Set(subtreeIds(doc, id));
  const nodes: Record<string, MindNode> = {};
  for (const node of Object.values(doc.nodes)) {
    if (!doomed.has(node.id)) nodes[node.id] = node;
  }
  const parent = nodes[parentId] as MindNode;
  nodes[parentId] = { ...parent, children: parent.children.filter((child) => child !== id) };
  return { ...doc, nodes };
}

export function rename(doc: MindDoc, id: string, text: string): MindDoc {
  const node = doc.nodes[id];
  const clean = text.slice(0, MAX_TEXT);
  if (!node || node.text === clean) return doc;
  return put(doc, { ...node, text: clean });
}

/** Leaves have nothing to collapse. */
export function toggleCollapse(doc: MindDoc, id: string): MindDoc {
  const node = doc.nodes[id];
  if (!node || node.children.length === 0) return doc;
  return put(doc, { ...node, collapsed: !node.collapsed });
}

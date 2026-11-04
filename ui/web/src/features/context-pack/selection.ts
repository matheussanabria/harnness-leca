// Read-only projection of a MindDoc: the selected subtree in breadth-first model order and its ancestor path.
import type { MindDoc } from "../mindmap/types.ts";
import { displayText, pathText } from "./markdown.ts";
import type { PackNode } from "./types.ts";

export interface Entry {
  id: string;
  depth: number;
  parentId: string | null;
  text: string;
}

export interface PathEntry {
  id: string;
  text: string;
}

/** Breadth-first, model-order subtree of the selected node; collapsed nodes are still included. */
export function collectSubtree(doc: MindDoc, selectedId: string): Entry[] {
  const queue: Array<{ id: string; depth: number; parentId: string | null }> = [
    { id: selectedId, depth: 0, parentId: null },
  ];
  const seen = new Set<string>([selectedId]);
  const entries: Entry[] = [];
  for (let head = 0; head < queue.length; head += 1) {
    const { id, depth, parentId } = queue[head] as { id: string; depth: number; parentId: string | null };
    const node = doc.nodes[id];
    if (!node) continue;
    entries.push({ id: node.id, depth, parentId, text: displayText(node.text) });
    for (const child of node.children) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push({ id: child, depth: depth + 1, parentId: node.id });
    }
  }
  return entries;
}

function parentMap(doc: MindDoc): Map<string, string> {
  const parents = new Map<string, string>();
  for (const node of Object.values(doc.nodes)) {
    for (const child of node.children) {
      if (!parents.has(child)) parents.set(child, node.id);
    }
  }
  return parents;
}

/** Root-down ancestor path of the selection, defensive against cycles and missing parents. */
export function ancestorPath(doc: MindDoc, selectedId: string): PathEntry[] {
  const parents = parentMap(doc);
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = selectedId;
  while (current !== undefined && !seen.has(current)) {
    ids.push(current);
    seen.add(current);
    if (current === doc.rootId) break;
    current = parents.get(current);
  }
  return ids.reverse().map((id) => ({ id, text: pathText(doc.nodes[id]?.text ?? "") }));
}

/** Nested projection of a kept BFS prefix; a missing parent can never add an orphan. */
export function toTree(entries: readonly Entry[]): PackNode | null {
  const first = entries[0];
  if (!first) return null;
  const root: PackNode = { id: first.id, text: first.text, children: [] };
  const byId = new Map<string, PackNode>([[root.id, root]]);
  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index] as Entry;
    const parent = entry.parentId === null ? undefined : byId.get(entry.parentId);
    if (!parent) continue;
    const node: PackNode = { id: entry.id, text: entry.text, children: [] };
    parent.children.push(node);
    byId.set(node.id, node);
  }
  return root;
}

/** Pre-order (parent before its children, siblings in model order) so Markdown nesting matches the JSON tree. */
export function flattenTree(root: PackNode | null): Array<{ depth: number; text: string }> {
  const out: Array<{ depth: number; text: string }> = [];
  const visit = (node: PackNode, depth: number): void => {
    out.push({ depth, text: node.text });
    for (const child of node.children) visit(child, depth + 1);
  };
  if (root) visit(root, 0);
  return out;
}

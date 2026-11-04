// Read-only queries over a MindDoc.
import type { MindDoc } from "./types.ts";

export function createDoc(rootId: string, text = "Central idea"): MindDoc {
  return { rootId, nodes: { [rootId]: { id: rootId, text, children: [], collapsed: false, dx: 0, dy: 0 } } };
}

/** Parent id of a node, or null for the root / unknown ids. */
export function parentOf(doc: MindDoc, id: string): string | null {
  for (const node of Object.values(doc.nodes)) {
    if (node.children.includes(id)) return node.id;
  }
  return null;
}

/** True when `candidate` is `id` itself or sits anywhere below it. */
export function isInSubtree(doc: MindDoc, id: string, candidate: string): boolean {
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === candidate) return true;
    stack.push(...(doc.nodes[current]?.children ?? []));
  }
  return false;
}

/** All ids in the subtree rooted at `id` (inclusive). */
export function subtreeIds(doc: MindDoc, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    out.push(current);
    stack.push(...(doc.nodes[current]?.children ?? []));
  }
  return out;
}

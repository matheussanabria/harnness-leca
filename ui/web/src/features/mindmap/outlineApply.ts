// Pure appliers that turn a parsed outline into mind-map nodes. Input documents are never mutated.
import { cleanOutlineText, type OutlineNode } from "./outline.ts";
import type { MindDoc, MindNode } from "./types.ts";
import { MAX_NODES, MAX_TEXT } from "./types.ts";

const ID_ATTEMPTS = 5;

interface IdPool {
  used: Set<string>;
  makeId: () => string;
}

interface Budget {
  remaining: number;
  added: number;
}

interface ApplyResult {
  doc: MindDoc;
  added: number;
}

/** Asks for ids until one is non-empty and unused, giving up after five attempts. */
function uniqueId(pool: IdPool): string | null {
  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
    const id = pool.makeId();
    if (id && !pool.used.has(id)) {
      pool.used.add(id);
      return id;
    }
  }
  return null;
}

function freshNode(id: string, text: string): MindNode {
  return { id, text: text.slice(0, MAX_TEXT), children: [], collapsed: false, dx: 0, dy: 0 };
}

/**
 * Appends `outline` under `parentId`, depth first and in order. Returns false as soon as the node budget runs out or
 * an id cannot be generated, so the caller keeps whatever was added so far.
 */
function attach(
  nodes: Record<string, MindNode>,
  parentId: string,
  outline: OutlineNode[],
  pool: IdPool,
  budget: Budget,
): boolean {
  for (const item of outline) {
    if (budget.remaining <= 0) return false;
    const id = uniqueId(pool);
    if (id === null) return false;
    nodes[id] = freshNode(id, item.text);
    const parent = nodes[parentId] as MindNode;
    nodes[parentId] = { ...parent, children: [...parent.children, id], collapsed: false };
    budget.remaining -= 1;
    budget.added += 1;
    if (!attach(nodes, id, item.children, pool, budget)) return false;
  }
  return true;
}

/** Appends the outline as the last children of an existing node, expanding that node. */
export function appendOutline(
  doc: MindDoc,
  parentId: string,
  outline: OutlineNode[],
  makeId: () => string,
): ApplyResult {
  if (!doc.nodes[parentId] || outline.length === 0) return { doc, added: 0 };
  const remaining = MAX_NODES - Object.keys(doc.nodes).length;
  if (remaining <= 0) return { doc, added: 0 };

  const nodes: Record<string, MindNode> = { ...doc.nodes };
  const pool: IdPool = { used: new Set(Object.keys(doc.nodes)), makeId };
  const budget: Budget = { remaining, added: 0 };
  attach(nodes, parentId, outline, pool, budget);
  return budget.added === 0 ? { doc, added: 0 } : { doc: { ...doc, nodes }, added: budget.added };
}

/**
 * Builds a new document that keeps only `doc.rootId`. A single top-level outline node becomes the root; otherwise
 * the root keeps `rootText` (cleaned) and every top-level node becomes its child.
 */
export function replaceWithOutline(
  doc: MindDoc,
  outline: OutlineNode[],
  makeId: () => string,
  rootText: string,
): ApplyResult {
  if (outline.length === 0) return { doc, added: 0 };

  const single = outline.length === 1 ? (outline[0] as OutlineNode) : null;
  const fallback = cleanOutlineText(rootText) || "Central idea";
  const text = single ? single.text : fallback;
  const nodes: Record<string, MindNode> = { [doc.rootId]: freshNode(doc.rootId, text) };
  const pool: IdPool = { used: new Set([doc.rootId]), makeId };
  const budget: Budget = { remaining: MAX_NODES - 1, added: 0 };
  attach(nodes, doc.rootId, single ? single.children : outline, pool, budget);
  return { doc: { rootId: doc.rootId, nodes }, added: budget.added };
}

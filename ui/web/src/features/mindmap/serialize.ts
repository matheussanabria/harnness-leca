// Board `data` <-> MindDoc. Input is untrusted: everything is validated and unknown shapes are rejected.
import type { MindDoc, MindmapData, MindNode } from "./types.ts";
import { MAX_NODES, MAX_TEXT, MINDMAP_SCHEMA } from "./types.ts";

export function toData(doc: MindDoc): MindmapData {
  return { schema: MINDMAP_SCHEMA, rootId: doc.rootId, nodes: Object.values(doc.nodes) };
}

export type ParseResult = { ok: true; doc: MindDoc } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseNode(raw: unknown): MindNode | null {
  if (!isRecord(raw)) return null;
  const { id, text, children, collapsed } = raw;
  if (typeof id !== "string" || !id || typeof text !== "string") return null;
  if (!Array.isArray(children) || !children.every((child) => typeof child === "string")) return null;
  return { id, text: text.slice(0, MAX_TEXT), children: children as string[], collapsed: collapsed === true };
}

/** Validates ids, references, a single root and absence of cycles or shared children (each node reachable once). */
export function fromData(input: unknown): ParseResult {
  if (!isRecord(input) || input.schema !== MINDMAP_SCHEMA) return { ok: false, error: "Not a mindmap@1 document." };
  const { rootId, nodes: rawNodes } = input;
  if (typeof rootId !== "string" || !Array.isArray(rawNodes)) return { ok: false, error: "Malformed document." };
  if (rawNodes.length === 0 || rawNodes.length > MAX_NODES) return { ok: false, error: "Invalid node count." };
  const nodes: Record<string, MindNode> = {};
  for (const raw of rawNodes) {
    const node = parseNode(raw);
    if (!node) return { ok: false, error: "Malformed node." };
    if (nodes[node.id]) return { ok: false, error: `Duplicate node id: ${node.id}` };
    nodes[node.id] = node;
  }
  if (!nodes[rootId]) return { ok: false, error: "Root node is missing." };
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) return { ok: false, error: "Cycle or shared child detected." };
    seen.add(id);
    for (const child of (nodes[id] as MindNode).children) {
      if (!nodes[child]) return { ok: false, error: `Unknown child: ${child}` };
      stack.push(child);
    }
  }
  if (seen.size !== rawNodes.length) return { ok: false, error: "Unreachable nodes found." };
  return { ok: true, doc: { rootId, nodes } };
}

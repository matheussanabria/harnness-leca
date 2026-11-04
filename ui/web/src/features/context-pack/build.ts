// Pure, deterministic builder for the mind-map selection context pack.
//
// Truncation order: the ancestor path and the selected node always stay. The subtree is kept level by level
// (breadth first, siblings in model order); a node is kept only when the Markdown with that node plus the
// truncation marker still fits the budget. The first node that does not fit stops its level and every deeper
// level, so the result is always a connected top-of-tree prefix and deepest/last nodes are dropped first.
// If the path and the selected node alone exceed the budget, path segments are cut from the root side (the
// tail is kept behind a "... > " prefix) and only the selected node stays, with the marker. As a last resort
// the board heading is dropped and the selected text is shrunk so the Markdown never exceeds the budget.
import type { MindDoc } from "../mindmap/types.ts";
import { fitsSelected, greedyKept, headerLength, prefixLengths, truncationExtra } from "./fitting.ts";
import { boardText, capText, pathLine, renderMarkdown } from "./markdown.ts";
import type { Entry, PathEntry } from "./selection.ts";
import { ancestorPath, collectSubtree, flattenTree, toTree } from "./selection.ts";
import type { ContextPack, PackJson, PackOptions } from "./types.ts";
import { CONTEXT_PACK_SCHEMA, DEFAULT_BUDGET, MIN_BUDGET } from "./types.ts";

interface PackInput {
  board: string | null;
  pathLineText: string;
  pathEntries: readonly PathEntry[];
  start: number;
  kept: readonly Entry[];
  total: number;
  budget: number;
}

function resolveBudget(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BUDGET;
  return Math.max(MIN_BUDGET, Math.floor(value));
}

function emptyPack(budget: number): ContextPack {
  const json: PackJson = {
    schema: CONTEXT_PACK_SCHEMA,
    empty: true,
    board: null,
    path: [],
    tree: null,
    truncated: false,
    omitted: 0,
    budget,
  };
  return { schema: CONTEXT_PACK_SCHEMA, empty: true, markdown: "", json, truncated: false, omitted: 0, budget };
}

function buildPack(input: PackInput): ContextPack {
  const omitted = input.total - input.kept.length;
  // The kept set is chosen breadth first, but it is rendered in pre-order from the same tree the JSON uses.
  const tree = toTree(input.kept);
  const markdown = renderMarkdown(input.board, input.pathLineText, flattenTree(tree), omitted);
  const json: PackJson = {
    schema: CONTEXT_PACK_SCHEMA,
    empty: false,
    board: input.board,
    path: input.pathEntries.slice(input.start).map((entry) => ({ id: entry.id, text: entry.text })),
    tree,
    truncated: omitted > 0,
    omitted,
    budget: input.budget,
  };
  return {
    schema: CONTEXT_PACK_SCHEMA,
    empty: false,
    markdown,
    json,
    truncated: omitted > 0,
    omitted,
    budget: input.budget,
  };
}

/**
 * Builds the pack for the selected node and its whole subtree, plus the ancestor path as context.
 *
 * Truncation: nodes are kept level by level (breadth first, siblings in model order). A node is kept only if
 * the Markdown including it and the truncation marker still fits the budget; the first node that does not fit
 * stops that level and all deeper levels, so no orphan is ever emitted. The deepest and last nodes are dropped
 * first. The path line and the selected node always stay; if they alone exceed the budget, path segments are cut
 * from the root side (tail kept behind "... > ") and the subtree is dropped entirely with the marker
 * "[truncated: N nodes omitted]". Markdown and JSON always describe the same kept set and never exceed the budget.
 */
export function buildContextPack(doc: MindDoc, selectedId: string | null, options: PackOptions = {}): ContextPack {
  const budget = resolveBudget(options.budget);
  const selected = selectedId === null ? undefined : doc.nodes[selectedId];
  if (!selected) return emptyPack(budget);
  const board = options.boardTitle === undefined ? null : boardText(options.boardTitle);
  const pathEntries = ancestorPath(doc, selected.id);
  const segments = pathEntries.map((entry) => entry.text);
  const entries = collectSubtree(doc, selected.id);
  const total = entries.length;

  const fullLine = pathLine(segments, 0);
  const kept = greedyKept(prefixLengths(headerLength(board, fullLine), entries), total, budget);
  if (kept > 0) {
    const input: PackInput = {
      board,
      pathLineText: fullLine,
      pathEntries,
      start: 0,
      kept: entries.slice(0, kept),
      total,
      budget,
    };
    return buildPack(input);
  }

  const selectedText = (entries[0] as Entry).text;
  for (let start = 1; start < segments.length; start += 1) {
    const line = pathLine(segments, start);
    if (fitsSelected(headerLength(board, line), selectedText, total, budget)) {
      const input: PackInput = {
        board,
        pathLineText: line,
        pathEntries,
        start,
        kept: entries.slice(0, 1),
        total,
        budget,
      };
      return buildPack(input);
    }
  }

  const start = Math.max(0, segments.length - 1);
  const line = pathLine(segments, start);
  const extra = truncationExtra(total - 1);
  let chosen = board;
  let header = headerLength(chosen, line);
  if (header + 1 + 2 + extra >= budget && chosen !== null) {
    chosen = null;
    header = headerLength(chosen, line);
  }
  const room = Math.max(1, budget - header - 1 - 2 - extra);
  const input: PackInput = {
    board: chosen,
    pathLineText: line,
    pathEntries,
    start,
    kept: [{ ...(entries[0] as Entry), text: capText(selectedText, room) }],
    total,
    budget,
  };
  return buildPack(input);
}

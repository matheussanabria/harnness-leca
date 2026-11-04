// Pure bridge between the mind-map island and the legacy chat. Window events are the only contract, no DOM here.
import { buildContextPack } from "../context-pack/index.ts";
import { normalizeText } from "../context-pack/markdown.ts";
import { parseOutline } from "./outline.ts";
import { appendOutline, replaceWithOutline } from "./outlineApply.ts";
import type { MindDoc } from "./types.ts";

export const CANVAS_STATE_EVENT = "harness:canvas-state";
export const CANVAS_APPLY_EVENT = "harness:canvas-apply";
/** Budget for the whole-map outline published to the chat. */
export const OUTLINE_BUDGET = 3000;

export type BlockMode = "append" | "new";
export type BlockParent = "selected" | "root";

/** One `<mindmap>` block of a chat answer. */
export interface CanvasApplyBlock {
  mode: BlockMode;
  parent: BlockParent;
  body: string;
}

/** State published by the island and consumed by the legacy chat bridge. */
export interface CanvasState {
  boardId: string;
  title: string;
  selectedId: string;
  selectedText: string;
  outline: string;
}

export interface ApplyBlocksResult {
  doc: MindDoc;
  focusId: string | null;
  added: number;
  truncated: boolean;
}

/** Whole-map Markdown from the root, without the context-pack `Path:` line and its blank line. */
function outlineMarkdown(doc: MindDoc): string {
  const markdown = buildContextPack(doc, doc.rootId, { budget: OUTLINE_BUDGET }).markdown;
  const lines = markdown.split("\n");
  return (lines[0] ?? "").startsWith("Path:") ? lines.slice(2).join("\n") : markdown;
}

export function canvasStatePayload(
  doc: MindDoc,
  selectedId: string | null,
  boardId: string,
  title: string,
): CanvasState {
  const node = selectedId === null ? undefined : doc.nodes[selectedId];
  return {
    boardId,
    title,
    selectedId: node ? node.id : doc.rootId,
    selectedText: node ? normalizeText(node.text) : "",
    outline: outlineMarkdown(doc),
  };
}

/** Defensive reader: a malformed block invalidates the whole payload instead of applying half of it. */
function readBlock(value: unknown): CanvasApplyBlock | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const mode = raw.mode;
  const parent = raw.parent;
  if (mode !== "append" && mode !== "new") return null;
  if (parent !== "selected" && parent !== "root") return null;
  if (typeof raw.body !== "string") return null;
  return { mode, parent, body: raw.body };
}

/**
 * Applies chat blocks in order. `new` rebuilds the map first, so later blocks land on the new root. Focus follows the
 * first node added by the first block that changed anything (`new` blocks focus the root); unknown blocks are ignored.
 */
export function applyBlocks(
  doc: MindDoc,
  selectedId: string | null,
  blocks: readonly CanvasApplyBlock[],
  makeId: () => string,
  rootText: string,
): ApplyBlocksResult {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { doc, focusId: null, added: 0, truncated: false };
  }

  let current = doc;
  let focusId: string | null = null;
  let added = 0;
  let truncated = false;

  for (const value of blocks) {
    const block = readBlock(value);
    if (!block) continue;
    const outline = parseOutline(block.body);
    truncated = truncated || outline.truncated;

    if (block.mode === "new") {
      const next = replaceWithOutline(current, outline.nodes, makeId, rootText);
      if (next.doc === current) continue;
      if (focusId === null) focusId = current.rootId;
      current = next.doc;
      added += next.added;
      continue;
    }

    const parentId =
      block.parent === "root" || selectedId === null || !current.nodes[selectedId] ? current.rootId : selectedId;
    const before = current.nodes[parentId];
    const next = appendOutline(current, parentId, outline.nodes, makeId);
    if (next.doc === current) continue;
    if (focusId === null && before) {
      focusId = next.doc.nodes[parentId]?.children[before.children.length] ?? null;
    }
    current = next.doc;
    added += next.added;
  }

  return { doc: current, focusId, added, truncated };
}

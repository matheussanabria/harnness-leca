// Pure helpers of the board chat bridge (EP-19.09). No DOM, no network, no Date, no randomness; the input is never mutated.
import type { SceneElement } from "./types.ts";

const SHAPE_TYPES: ReadonlySet<string> = new Set(["rectangle", "ellipse", "diamond"]);
const ARROW_TYPES: ReadonlySet<string> = new Set(["arrow", "line"]);
const IMAGE_TYPE = "image";
const TEXT_TYPE = "text";

/** Longest text of one element in the outline. */
const MAX_TEXT_LENGTH = 120;
/** Most text elements listed in the outline. */
const MAX_TEXT_ELEMENTS = 60;
/** Longest Mermaid body accepted from a chat answer. */
export const MAX_BOARD_BODY = 20000;
/** Reading order groups elements in rows of this many pixels. */
const ROW_HEIGHT = 10;

const SUPPORTED_HEADERS = ["flowchart", "graph", "sequencediagram", "classdiagram"];

/** State published by the board island and consumed by the legacy chat bridge. */
export interface BoardStatePayload {
  boardId: string;
  title: string;
  selectedId: string;
  selectedText: string;
  outline: string;
}

/** A `<board>` block accepted by the converter. */
export interface NormalizedBoardBlock {
  ok: true;
  mode: "replace" | "append";
  source: string;
}

/** A `<board>` block refused before it reaches the converter. */
export interface InvalidBoardBlock {
  ok: false;
  reason: string;
}

export type BoardBlockResult = NormalizedBoardBlock | InvalidBoardBlock;

/** Trims, collapses whitespace runs and caps at MAX_TEXT_LENGTH with a trailing ellipsis. */
function normalizeText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_TEXT_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_TEXT_LENGTH - 3).trimEnd()}...`;
}

/** Reads a numeric coordinate; anything else counts as zero. */
function coordinate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface TextEntry {
  text: string;
  row: number;
  x: number;
  order: number;
}

/** Live text elements in reading order: rows of 10px, then left to right. */
function textEntries(elements: readonly SceneElement[]): TextEntry[] {
  const entries: TextEntry[] = [];
  for (const element of elements) {
    if (element.isDeleted || element.type !== TEXT_TYPE) continue;
    const text = normalizeText(element.text);
    if (text === "") continue;
    entries.push({
      text,
      row: Math.round(coordinate(element.y) / ROW_HEIGHT),
      x: coordinate(element.x),
      order: entries.length,
    });
  }
  return entries.sort((a, b) => a.row - b.row || a.x - b.x || a.order - b.order);
}

/** Short Portuguese summary of the live elements of a board. */
export function buildBoardOutline(elements: readonly SceneElement[]): string {
  const live = elements.filter((element) => !element.isDeleted);
  if (live.length === 0) return "(quadro vazio)";

  let shapes = 0;
  let arrows = 0;
  let images = 0;
  for (const element of live) {
    if (SHAPE_TYPES.has(element.type)) shapes += 1;
    else if (ARROW_TYPES.has(element.type)) arrows += 1;
    else if (element.type === IMAGE_TYPE) images += 1;
  }

  const lines = [`Elementos: ${shapes} formas, ${arrows} setas/linhas, ${images} imagens`];
  const entries = textEntries(live);
  for (const entry of entries.slice(0, MAX_TEXT_ELEMENTS)) lines.push(`- ${entry.text}`);
  const omitted = entries.length - MAX_TEXT_ELEMENTS;
  if (omitted > 0) lines.push(`... (mais ${omitted} textos)`);
  return lines.join("\n");
}

/** Builds the state payload published to the chat. */
export function boardStatePayload(
  boardId: string,
  title: string,
  elements: readonly SceneElement[],
): BoardStatePayload {
  return {
    boardId,
    title,
    selectedId: "",
    selectedText: "",
    outline: buildBoardOutline(elements),
  };
}

/** Removes a surrounding Markdown fence (``` or ```mermaid, any case). */
function stripFence(body: string): string {
  const text = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text.startsWith("```")) return text;

  const newline = text.indexOf("\n");
  const opening = newline < 0 ? text : text.slice(0, newline);
  const info = opening.slice(3).trim().toLowerCase();
  if (info !== "" && info !== "mermaid") return text;

  const inside = newline < 0 ? "" : text.slice(newline + 1);
  const lines = inside.split("\n");
  while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") lines.pop();
  if ((lines[lines.length - 1] ?? "").trim() === "```") lines.pop();
  return lines.join("\n").trim();
}

/** True when the first line that is neither empty nor a `%%` comment starts a supported diagram. */
function hasSupportedHeader(source: string): boolean {
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("%%")) continue;
    const lower = trimmed.toLowerCase();
    return SUPPORTED_HEADERS.some((header) => lower.startsWith(header));
  }
  return false;
}

/** Normalizes a `<board>` block: cleans the body and checks the diagram type. */
export function normalizeBoardBlock(block: unknown): BoardBlockResult {
  if (typeof block !== "object" || block === null || Array.isArray(block)) {
    return { ok: false, reason: "invalid block" };
  }
  const raw = block as Record<string, unknown>;
  if (typeof raw.body !== "string") return { ok: false, reason: "invalid block" };

  const mode: "replace" | "append" = raw.mode === "replace" ? "replace" : "append";
  const source = stripFence(raw.body).trim().slice(0, MAX_BOARD_BODY);
  if (source === "") return { ok: false, reason: "empty diagram" };
  if (!hasSupportedHeader(source)) return { ok: false, reason: "unsupported diagram type" };
  return { ok: true, mode, source };
}

interface Box {
  left: number;
  top: number;
  bottom: number;
}

/** Bounding box of the elements that carry every coordinate; elements missing one are ignored. */
function boundingBox(elements: readonly SceneElement[]): Box | null {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const { x, y, width, height } = element;
    if (typeof x !== "number" || !Number.isFinite(x)) continue;
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    if (typeof width !== "number" || !Number.isFinite(width)) continue;
    if (typeof height !== "number" || !Number.isFinite(height)) continue;
    if (x < left) left = x;
    if (y < top) top = y;
    if (y + height > bottom) bottom = y + height;
  }
  if (left === Number.POSITIVE_INFINITY) return null;
  return { left, top, bottom };
}

/**
 * Copies `added` shifted below the live elements of `existing`: the added box starts `gap` px under the bottom of
 * the existing one and shares its left edge. Only `x` and `y` change, so relative arrow points stay valid.
 */
export function placeBelow<T extends SceneElement>(
  existing: readonly SceneElement[],
  added: readonly T[],
  gap = 60,
): T[] {
  const live = existing.filter((element) => !element.isDeleted);
  const target = boundingBox(live);
  const source = boundingBox(added);
  if (!target || !source) return added.map((element) => ({ ...element }) as unknown as T);

  const shiftX = target.left - source.left;
  const shiftY = target.bottom + gap - source.top;
  return added.map((element) => {
    const copy: Record<string, unknown> = { ...element };
    if (typeof element.x === "number" && Number.isFinite(element.x)) copy.x = element.x + shiftX;
    if (typeof element.y === "number" && Number.isFinite(element.y)) copy.y = element.y + shiftY;
    return copy as unknown as T;
  });
}

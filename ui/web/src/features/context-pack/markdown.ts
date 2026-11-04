// Markdown rendering for the context pack: text normalization, path line, bullets and the truncation marker.
import { MAX_BOARD_TEXT, MAX_NODE_TEXT, MAX_PATH_TEXT } from "./types.ts";

export interface Bullet {
  depth: number;
  text: string;
}

const isControl = (code: number): boolean => code < 32 || (code >= 127 && code <= 159);

/** Trims, replaces control characters and collapses whitespace runs to a single space. */
export function normalizeText(raw: string): string {
  let cleaned = "";
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    cleaned += isControl(code) ? " " : raw.charAt(index);
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

/** Hard cap with a trailing "..."; max <= 3 keeps a plain slice so the size still fits. */
export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, Math.max(0, max));
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

/** Node text shown in Markdown and JSON: normalized, capped and with an empty fallback. */
export function displayText(raw: string, max = MAX_NODE_TEXT): string {
  const text = normalizeText(raw);
  return text.length === 0 ? "(empty)" : capText(text, max);
}

/** Path segments have their own, smaller cap. */
export function pathText(raw: string): string {
  return displayText(raw, MAX_PATH_TEXT);
}

/** Optional board heading; an empty title means no heading. */
export function boardText(raw: string): string | null {
  const text = normalizeText(raw);
  return text.length === 0 ? null : capText(text, MAX_BOARD_TEXT);
}

export function truncationMarker(omitted: number): string {
  return `[truncated: ${omitted} nodes omitted]`;
}

/** Path line for the kept tail, with a leading ellipsis when root-side segments were cut. */
export function pathLine(segments: readonly string[], start: number): string {
  const tail = segments.slice(start).join(" > ");
  return start > 0 ? `Path: ... > ${tail}` : `Path: ${tail}`;
}

/** Exact layout: optional board line, path line, blank line, nested bullets, marker last. */
export function renderMarkdown(
  board: string | null,
  pathLineText: string,
  bullets: readonly Bullet[],
  omitted: number,
): string {
  const lines: string[] = [];
  if (board !== null) lines.push(`# ${board}`);
  lines.push(pathLineText, "");
  for (const bullet of bullets) lines.push(`${"  ".repeat(bullet.depth)}- ${bullet.text}`);
  if (omitted > 0) lines.push(truncationMarker(omitted));
  return lines.join("\n");
}

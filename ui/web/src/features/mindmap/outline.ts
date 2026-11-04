// Pure Markdown-bullet outline parser. No DOM, no I/O, no randomness, and it never mutates its input.
import { MAX_TEXT } from "./types.ts";

export interface OutlineNode {
  text: string;
  children: OutlineNode[];
}

/** Maximum number of nodes one parse may produce; extra bullets set `truncated`. */
export const MAX_OUTLINE_NODES = 200;
/** Maximum nesting depth. Top-level bullets sit at depth 1, so this means eight levels. */
export const MAX_OUTLINE_DEPTH = 8;

const BULLET = /^([ \t]*)(?:[-*+]|\d+[.)]) +(.*)$/;
const CONTROL = /\p{Cc}/gu;
const MARKERS = ["**", "__", "`"];

/** Indentation width in columns; a tab counts as four spaces. */
function indentWidth(raw: string): number {
  let width = 0;
  for (const char of raw) width += char === "\t" ? 4 : 1;
  return width;
}

/**
 * Same cleaning as node text: control characters become spaces, whitespace runs collapse, one surrounding
 * Markdown marker pair is removed, and long text is cut at MAX_TEXT with a trailing ellipsis.
 */
export function cleanOutlineText(raw: string): string {
  let text = raw.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  for (const marker of MARKERS) {
    if (text.length > marker.length * 2 && text.startsWith(marker) && text.endsWith(marker)) {
      text = text.slice(marker.length, -marker.length).trim();
      break;
    }
  }
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 3)}...` : text;
}

interface Level {
  indent: number;
  /** Sibling list that receives nodes of this level. */
  list: OutlineNode[];
  /** Most recently added node of this level. */
  last: OutlineNode;
}

/**
 * Parses a Markdown bullet outline into a tree. Depth follows indentation relative to the previous bullet, so 2
 * spaces, 4 spaces, tabs and inconsistent indentation all work; one deeper level is added at most per bullet.
 */
export function parseOutline(text: string): { nodes: OutlineNode[]; truncated: boolean } {
  const roots: OutlineNode[] = [];
  const levels: Level[] = [];
  let previousIndent = 0;
  let total = 0;
  let truncated = false;
  let fenced = false;

  for (const line of text.split(/\r\n|\r|\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = BULLET.exec(line);
    if (!match) continue;
    const indent = indentWidth(match[1] as string);
    const label = cleanOutlineText(match[2] as string);
    if (!label) continue;
    if (total >= MAX_OUTLINE_NODES) {
      truncated = true;
      break;
    }

    const node: OutlineNode = { text: label, children: [] };
    total += 1;
    const top = levels[levels.length - 1];
    if (!top) {
      roots.push(node);
      levels.push({ indent, list: roots, last: node });
    } else if (indent > previousIndent && levels.length < MAX_OUTLINE_DEPTH) {
      top.last.children.push(node);
      levels.push({ indent, list: top.last.children, last: node });
    } else if (indent > previousIndent) {
      // At the depth cap a deeper bullet attaches as a sibling at the deepest allowed level.
      top.list.push(node);
      top.last = node;
    } else {
      while (levels.length > 1 && (levels[levels.length - 1] as Level).indent > indent) levels.pop();
      const level = levels[levels.length - 1] as Level;
      level.list.push(node);
      level.last = node;
    }
    previousIndent = indent;
  }

  return { nodes: roots, truncated };
}

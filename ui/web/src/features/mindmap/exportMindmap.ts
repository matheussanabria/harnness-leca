// Pure mind-map exports: a Markdown outline and a standalone SVG. Collapsed branches are exported in full.
import { layoutTree, renderedPosition } from "./layout.ts";
import type { MindDoc } from "./types.ts";

const MARGIN = 24;
const FONT_SIZE = 14;
const LINE_HEIGHT = 17;
const PAD_X = 10;
const MAX_LINES = 2;

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Root as a heading, every other node as a nested bullet, in tree order. */
export function toOutlineMarkdown(doc: MindDoc): string {
  const root = doc.nodes[doc.rootId];
  if (!root) return "";
  const lines = [`# ${oneLine(root.text) || "Mind map"}`, ""];
  const seen = new Set<string>([root.id]);
  const walk = (ids: string[], depth: number) => {
    for (const id of ids) {
      const node = doc.nodes[id];
      if (!node || seen.has(id)) continue;
      seen.add(id);
      lines.push(`${"  ".repeat(depth)}- ${oneLine(node.text)}`);
      walk(node.children, depth + 1);
    }
  };
  walk(root.children, 0);
  return `${lines.join("\n")}\n`;
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Greedy word wrap into at most maxLines lines (default 2); when text is cut, the last line ends with "...". */
export function wrapText(text: string, maxChars: number, maxLines = MAX_LINES): string[] {
  const lines: string[] = [];
  let current = "";
  for (const raw of oneLine(text).split(" ").filter(Boolean)) {
    const word = raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}-` : raw;
    if (!current || `${current} ${word}`.length <= maxChars) {
      current = current ? `${current} ${word}` : word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const last = lines[maxLines - 1] ?? "";
  return [...lines.slice(0, maxLines - 1), `${last.slice(0, Math.max(1, maxChars - 3))}...`];
}

export interface SvgExport {
  svg: string;
  width: number;
  height: number;
}

/** Standalone SVG of the whole tree (collapsed nodes expanded), light theme, with a solid background. */
export function toSvg(doc: MindDoc): SvgExport {
  const expanded: MindDoc = {
    ...doc,
    nodes: Object.fromEntries(Object.entries(doc.nodes).map(([id, node]) => [id, { ...node, collapsed: false }])),
  };
  const placed = layoutTree(expanded).map((item) => ({ ...item, ...renderedPosition(expanded, item) }));
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const maxX = Math.max(...placed.map((p) => p.x + p.w));
  const maxY = Math.max(...placed.map((p) => p.y + p.h));
  const width = Math.ceil(maxX - minX + MARGIN * 2);
  const height = Math.ceil(maxY - minY + MARGIN * 2);
  const at = new Map(placed.map((p) => [p.id, { x: p.x - minX + MARGIN, y: p.y - minY + MARGIN, w: p.w, h: p.h }]));

  const edges = placed
    .filter((p) => p.parentId && at.has(p.parentId))
    .map((p) => {
      const from = at.get(p.parentId as string) as { x: number; y: number; w: number; h: number };
      const to = at.get(p.id) as { x: number; y: number; w: number; h: number };
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const mid = (x1 + x2) / 2;
      return `<path d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`;
    });
  const boxes = placed.map((p) => {
    const pos = at.get(p.id) as { x: number; y: number; w: number; h: number };
    const isRoot = p.id === doc.rootId;
    const maxChars = Math.floor((pos.w - PAD_X * 2) / (FONT_SIZE * 0.55));
    const maxLines = Math.max(MAX_LINES, Math.floor((pos.h - 8) / LINE_HEIGHT));
    const lines = wrapText(doc.nodes[p.id]?.text ?? "", maxChars, maxLines);
    const first = pos.y + pos.h / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2 + FONT_SIZE * 0.35;
    const tspans = lines
      .map((line, i) => `<tspan x="${pos.x + pos.w / 2}" y="${first + i * LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
      .join("");
    return (
      `<rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="8" ` +
      `fill="${isRoot ? "#2563eb" : "#ffffff"}" stroke="${isRoot ? "#1d4ed8" : "#cbd5e1"}" stroke-width="1.5"/>` +
      `<text text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${FONT_SIZE}" ` +
      `fill="${isRoot ? "#ffffff" : "#0f172a"}">${tspans}</text>`
    );
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="#f8fafc"/>${edges.join("")}${boxes.join("")}</svg>`;
  return { svg, width, height };
}

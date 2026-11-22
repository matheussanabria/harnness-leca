// Diagram type from the header line of the source (EP-21.03). Pure: the real check is mermaid.parse (validate.ts);
// this runs first so an unsupported or unknown header gets a clear message instead of a parser error.
import type { Detection, DiagramType } from "./types.ts";

/**
 * Header keyword (Mermaid matches them case sensitively at the start of the first content line) to supported type.
 * `flowchart-elk` and other variants are not listed on purpose: they are refused as unsupported.
 */
const HEADERS: ReadonlyArray<readonly [RegExp, DiagramType]> = [
  [/^(?:flowchart|graph)(?=\s|$)/, "flowchart-v2"],
  [/^sequenceDiagram(?=\s|$)/, "sequence"],
  [/^classDiagram(?:-v2)?(?=\s|$)/, "classDiagram"],
  [/^stateDiagram(?:-v2)?(?=\s|$)/, "stateDiagram"],
  [/^erDiagram(?=\s|$)/, "er"],
  [/^gantt(?=\s|$)/, "gantt"],
];

/** Mermaid families Mermaid itself accepts but the editor does not offer (ADR-014, item 9). */
const KNOWN_UNSUPPORTED = new Set([
  "pie",
  "journey",
  "gitgraph",
  "quadrantchart",
  "requirementdiagram",
  "c4context",
  "c4container",
  "c4component",
  "c4dynamic",
  "c4deployment",
  "timeline",
  "sankey",
  "xychart-beta",
  "xychart",
  "block-beta",
  "block",
  "packet-beta",
  "packet",
  "architecture-beta",
  "architecture",
  "kanban",
  "radar-beta",
  "radar",
  "zenuml",
]);

/** Removes a leading `---` front matter block (it ends at the next line that is only `---`). */
export function stripFrontMatter(source: string): string {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return source;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return end === -1 ? source : lines.slice(end + 1).join("\n");
}

/** First line that holds diagram content: skips front matter, blank lines and `%%` comments or directives. */
export function headerLine(source: string): string {
  for (const raw of stripFrontMatter(source).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%%")) continue;
    return line;
  }
  return "";
}

export function detectType(source: string): Detection {
  const header = headerLine(source);
  if (header === "") return { kind: "unknown" };
  for (const [pattern, type] of HEADERS) {
    if (pattern.test(header)) return { kind: "supported", type };
  }
  const word = header.split(/\s+/)[0] ?? header;
  if (word === "mindmap") return { kind: "refused", reason: "mindmap", header: word };
  // A header Mermaid knows but the editor does not offer is refused; anything else is treated as a typo (unknown).
  const family = word.toLowerCase();
  return KNOWN_UNSUPPORTED.has(family) || family.startsWith("flowchart-")
    ? { kind: "refused", reason: "unsupported", header: word }
    : { kind: "unknown" };
}

export const isSupported = (type: string): type is DiagramType => HEADERS.some(([, supported]) => supported === type);

/** Types shown to people in messages, in the order of the editor. */
export const SUPPORTED_LABELS: Record<DiagramType, string> = {
  "flowchart-v2": "flowchart",
  sequence: "sequenceDiagram",
  classDiagram: "classDiagram",
  stateDiagram: "stateDiagram-v2",
  er: "erDiagram",
  gantt: "gantt",
};

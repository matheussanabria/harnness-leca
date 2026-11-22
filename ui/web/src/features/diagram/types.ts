// Shared types of the Mermaid diagram feature (EP-21.03, ADR-014). No Mermaid or DOM imports: runs under node:test.

export const DIAGRAM_SCHEMA = "mermaid@1";

/** Same cap as the server (`MAX_DIAGRAM_SOURCE_BYTES` in canvas-kinds.js): the source is the truth and stays small. */
export const MAX_SOURCE_BYTES = 64 * 1024;

/** Types the editor accepts: what `mermaid.parse` reports as `diagramType`, filtered by our own list (ADR-014, item 9). */
export const SUPPORTED_TYPES = ["flowchart-v2", "sequence", "classDiagram", "stateDiagram", "er", "gantt"] as const;
export type DiagramType = (typeof SUPPORTED_TYPES)[number];

export const THEMES = ["default", "dark", "neutral", "forest"] as const;
export type DiagramTheme = (typeof THEMES)[number];

/** The opaque `data` payload stored in a board of kind "diagram". */
export interface DiagramData {
  schema: typeof DIAGRAM_SCHEMA;
  diagramType: DiagramType;
  source: string;
  theme?: DiagramTheme;
}

/** Why a source cannot be edited here. `mindmap` is refused on purpose: the Canvas has its own mind map kind. */
export type RefusalReason = "mindmap" | "unsupported";

export type Detection =
  | { kind: "supported"; type: DiagramType }
  | { kind: "refused"; reason: RefusalReason; header: string }
  | { kind: "unknown" };

/** Short, human readable outcome, also fed back to a model asked to repair the diagram. */
export type ValidationResult = { ok: true; type: DiagramType } | { ok: false; line?: number; message: string };

export interface RenderResult {
  svg: string;
  /** Natural size read from the SVG viewBox, used by the PNG export. */
  width: number;
  height: number;
}

export interface DiagramSummary {
  id: string;
  kind: string;
  title: string;
  rev: number;
  updatedAt: string;
}

export interface DiagramBoard extends DiagramSummary {
  v: number;
  createdAt: string;
  data: unknown;
}

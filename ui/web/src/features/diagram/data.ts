// Reading and building the `data` payload of a diagram board (kind "diagram", schema mermaid@1). Pure.
import { isSupported } from "./detect.ts";
import type { DiagramData, DiagramTheme, DiagramType } from "./types.ts";
import { DIAGRAM_SCHEMA, MAX_SOURCE_BYTES, THEMES } from "./types.ts";

export function createDiagramData(source: string, diagramType: DiagramType, theme?: DiagramTheme): DiagramData {
  return theme && theme !== "default"
    ? { schema: DIAGRAM_SCHEMA, diagramType, source, theme }
    : { schema: DIAGRAM_SCHEMA, diagramType, source };
}

/**
 * Reads a stored payload, or null when it is not a valid mermaid@1 diagram. The server only checks the shape and
 * the size (canvas-kinds.js); this is the client side of that contract. Never throws.
 */
export function readDiagramData(raw: unknown): DiagramData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (data.schema !== DIAGRAM_SCHEMA) return null;
  if (typeof data.source !== "string" || new TextEncoder().encode(data.source).length > MAX_SOURCE_BYTES) return null;
  if (typeof data.diagramType !== "string" || !isSupported(data.diagramType)) return null;
  const theme = THEMES.find((candidate) => candidate === data.theme);
  return createDiagramData(data.source, data.diagramType, theme);
}

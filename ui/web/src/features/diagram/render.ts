// Rendering of a Mermaid source to a sanitized SVG (EP-21.03). One of the two modules allowed to import Mermaid (the
// other is validate.ts); Mermaid and DOMPurify are both loaded lazily, on the first render.
import { ensureInitialized, type MermaidLoader, nextRenderId } from "./config.ts";
import { describeParseError } from "./errors.ts";
import { svgSize } from "./svg.ts";
import type { DiagramTheme, RenderResult } from "./types.ts";

const loadMermaid: MermaidLoader = async () =>
  (await import("mermaid")).default as unknown as Awaited<ReturnType<MermaidLoader>>;

export interface Sanitizer {
  sanitize(svg: string, options: Record<string, unknown>): string;
}
export type SanitizerLoader = () => Promise<Sanitizer>;

const loadSanitizer: SanitizerLoader = async () => (await import("dompurify")).default as unknown as Sanitizer;

/**
 * Defense in depth: Mermaid's strict mode already encodes labels, and the SVG profile drops anything executable
 * (scripts, event handlers, javascript: links, foreignObject). The <style> Mermaid emits for its theme is kept.
 */
export const SANITIZE_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "foreignObject"],
} as const;

export class DiagramRenderError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.name = "DiagramRenderError";
    if (line !== undefined) this.line = line;
  }
}

/** `load` and `loadPurify` are injectable for tests. */
export function createRenderer(load: MermaidLoader = loadMermaid, loadPurify: SanitizerLoader = loadSanitizer) {
  return async function render(source: string, theme: DiagramTheme = "default"): Promise<RenderResult> {
    const id = nextRenderId();
    try {
      const mermaid = await load();
      ensureInitialized(mermaid, theme);
      const { svg } = await mermaid.render(id, source);
      const clean = (await loadPurify()).sanitize(svg, { ...SANITIZE_OPTIONS });
      return { svg: clean, ...svgSize(clean) };
    } catch (error) {
      // Mermaid leaves a temporary element behind when it fails; remove it so failed renders do not pile up.
      if (typeof document !== "undefined") document.getElementById(`d${id}`)?.remove();
      const described = describeParseError(error, source);
      throw new DiagramRenderError(described.message, described.line);
    }
  };
}

export const renderDiagram = createRenderer();

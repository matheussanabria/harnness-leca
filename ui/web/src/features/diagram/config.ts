// Secure Mermaid configuration (ADR-014, item 6) shared by validate.ts and render.ts. Pure: it never imports Mermaid,
// the two modules that do hand it the library, so the "mermaid only in validate.ts and render.ts" rule stays checkable.
import type { DiagramTheme } from "./types.ts";

/** What the two modules need from the Mermaid library. */
export interface MermaidLike {
  initialize(config: Record<string, unknown>): void;
  parse(text: string, options?: { suppressErrors?: boolean }): Promise<unknown>;
  render(id: string, text: string): Promise<{ svg: string }>;
}

/** Loads the library on first use (ADR-014, item 7: lazy). Each of validate.ts and render.ts supplies its own. */
export type MermaidLoader = () => Promise<MermaidLike>;

/**
 * `securityLevel: "strict"` encodes the HTML in labels and disables click handlers and callbacks; `htmlLabels: false`
 * keeps labels as plain SVG text (no foreignObject), so the rendered SVG has nothing executable in it.
 */
export function secureConfig(theme: DiagramTheme = "default"): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    theme,
    logLevel: "fatal",
  };
}

let appliedTheme: DiagramTheme | null = null;
let appliedTo: MermaidLike | null = null;

/** Initializes Mermaid with the secure config; repeated calls with the same library and theme do nothing. */
export function ensureInitialized(mermaid: MermaidLike, theme: DiagramTheme = "default"): void {
  if (appliedTo === mermaid && appliedTheme === theme) return;
  mermaid.initialize(secureConfig(theme));
  appliedTo = mermaid;
  appliedTheme = theme;
}

let counter = 0;
/** Unique, DOM-safe id for one render (Mermaid inserts a temporary element with it). */
export function nextRenderId(): string {
  counter += 1;
  return `harness-diagram-${counter}`;
}

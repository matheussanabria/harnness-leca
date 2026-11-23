// Live preview engine (EP-21.04): validates and renders a source, and guarantees that a slower, older run never
// overwrites a newer one (the prototype showed the race: two renders in flight, the old one finishing last).
// Pure: `validate` and `render` are injected, so it is tested with fakes and with the real Mermaid in a browser.
import type { DiagramTheme, RenderResult, ValidationResult } from "./types.ts";

export type PreviewState =
  | { status: "ok"; render: RenderResult }
  /** `lastGood` is the previous valid render of the same diagram, kept on screen dimmed. */
  | { status: "error"; line?: number; message: string; lastGood: RenderResult | null };

export interface PreviewDeps {
  validate: (source: string) => Promise<ValidationResult>;
  render: (source: string, theme?: DiagramTheme) => Promise<RenderResult>;
}

export interface PreviewEngine {
  /** Resolves to the state, or `null` when a newer `run` or a `reset` happened meanwhile (the caller ignores it). */
  run(source: string, theme?: DiagramTheme): Promise<PreviewState | null>;
  /** Forgets the last valid render and invalidates runs in flight; call when another diagram is opened. */
  reset(): void;
  lastGood(): RenderResult | null;
}

export function createPreviewEngine(deps: PreviewDeps): PreviewEngine {
  let sequence = 0;
  let lastGood: RenderResult | null = null;

  return {
    async run(source, theme) {
      sequence += 1;
      const mine = sequence;
      let state: PreviewState;
      const checked = await deps.validate(source);
      if (!checked.ok) {
        state = {
          status: "error",
          message: checked.message,
          lastGood,
          ...(checked.line ? { line: checked.line } : {}),
        };
      } else {
        try {
          state = { status: "ok", render: await deps.render(source, theme) };
        } catch (error) {
          const line = (error as { line?: number }).line;
          const message = error instanceof Error ? error.message : String(error);
          state = { status: "error", message, lastGood, ...(line ? { line } : {}) };
        }
      }
      if (mine !== sequence) return null;
      if (state.status === "ok") lastGood = state.render;
      return state;
    },
    reset() {
      sequence += 1;
      lastGood = null;
    },
    lastGood: () => lastGood,
  };
}

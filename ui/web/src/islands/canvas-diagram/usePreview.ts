// Debounced live preview: runs the preview engine (validate + render) after the person stops typing.
// The engine drops results of runs that were overtaken, so a slow old render never replaces a newer one.
import { useEffect, useMemo, useState } from "react";
import { createPreviewEngine, type PreviewState } from "../../features/diagram/preview.ts";
import { renderDiagram } from "../../features/diagram/render.ts";
import type { DiagramTheme, RenderResult } from "../../features/diagram/types.ts";
import { validateDiagram } from "../../features/diagram/validate.ts";

const DEBOUNCE_MS = 400;

export interface Preview {
  state: PreviewState | null;
  /** Last valid render, for the export (the text may be newer than the drawing). */
  lastGood: () => RenderResult | null;
}

/** `id` scopes the engine: opening another diagram starts clean, so nothing of the previous one is ever shown. */
export function usePreview(id: string, source: string, theme: DiagramTheme): Preview {
  const engine = useMemo(() => {
    void id;
    return createPreviewEngine({ validate: validateDiagram, render: renderDiagram });
  }, [id]);
  const [state, setState] = useState<PreviewState | null>(null);

  // Each id gets its own engine and its own first state.
  useEffect(() => {
    void id;
    setState(null);
    return () => engine.reset();
  }, [id, engine]);

  useEffect(() => {
    let live = true;
    const first = engine.lastGood() === null;
    const timer = setTimeout(
      () => {
        void engine.run(source, theme).then((next) => {
          if (live && next) setState(next);
        });
      },
      first ? 0 : DEBOUNCE_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [engine, source, theme]);

  return { state, lastGood: engine.lastGood };
}

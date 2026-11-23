// Loads one diagram board and reads its mermaid@1 payload (a foreign or corrupt payload is refused with a message).
import { useEffect, useState } from "react";
import type { DiagramApi } from "../../features/diagram/api.ts";
import { readDiagramData } from "../../features/diagram/data.ts";
import type { DiagramBoard, DiagramData } from "../../features/diagram/types.ts";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; board: DiagramBoard; data: DiagramData };

export function useDiagramLoad(api: DiagramApi, id: string): { state: LoadState; reload: () => void } {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // `attempt` is the retry trigger: bumping it re-runs the load (also used by "Carregar a versão salva").
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const board = await api.get(id);
        const data = readDiagramData(board.data);
        if (!data) throw new Error("Este diagrama tem um formato que o editor não reconhece.");
        if (!cancelled) setState({ status: "ready", board, data });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, id, attempt]);

  return { state, reload: () => setAttempt((value) => value + 1) };
}

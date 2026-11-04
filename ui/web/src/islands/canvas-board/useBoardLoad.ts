// Loads one board: fetches it, parses the stored scene and rehydrates image assets into in-memory files.
import { useEffect, useState } from "react";
import type { BoardApi } from "../../features/board/api";
import { deserializeScene, type Scene } from "../../features/board/serialize.ts";
import { rehydrateFiles } from "../../features/board/session.ts";
import type { Board, SceneFiles } from "../../features/board/types";
import { blobToDataUrl } from "./dataUrl";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board; scene: Scene; files: SceneFiles; missing: string[] };

export function useBoardLoad(api: BoardApi, id: string): { state: LoadState; reload: () => void } {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // `attempt` is the retry trigger: bumping it re-runs the load.
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const board = await api.get(id);
        const scene = deserializeScene(board.data);
        const { files, missing } = await rehydrateFiles(api, id, scene.files, blobToDataUrl);
        if (!cancelled) setState({ status: "ready", board, scene, files, missing });
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

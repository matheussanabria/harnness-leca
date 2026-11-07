// Autosave wiring of the open board: change detection, debounced saves, conflict and warning state.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type BoardApi, BoardApiError } from "../../features/board/api";
import { createAutosave, type SaveState } from "../../features/board/autosave.ts";
import { createBoardSession, type Snapshot } from "../../features/board/session.ts";
import { sceneSignature } from "../../features/board/signature.ts";
import type { Board, FileManifest, SceneElement, SceneFiles } from "../../features/board/types";

const SAVE_DELAY_MS = 1200;

export interface BoardSave {
  saveState: SaveState;
  errorMessage: string;
  warning: string;
  onSceneChange: (elements: readonly SceneElement[], appState: unknown, files: SceneFiles) => void;
  rename: (title: string) => Promise<void>;
  flush: () => Promise<void>;
}

export function useBoardSave(api: BoardApi, board: Board, manifest: FileManifest): BoardSave {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [warning, setWarning] = useState("");
  const snapshot = useRef<Snapshot | null>(null);
  const baseline = useRef<string | null>(null);

  const session = useMemo(
    () => createBoardSession(api, board.id, { rev: board.rev, manifest }),
    [api, board.id, board.rev, manifest],
  );

  const autosave = useMemo(
    () =>
      createAutosave({
        delayMs: SAVE_DELAY_MS,
        isConflict: (error) => error instanceof BoardApiError && error.isConflict,
        onState: (state, error) => {
          setSaveState(state);
          setErrorMessage(error instanceof Error ? error.message : "");
        },
        save: async () => {
          if (!snapshot.current) return;
          const { unsupported } = await session.save(snapshot.current);
          setWarning(
            unsupported.length
              ? `${unsupported.length} image(s) in an unsupported format (for example SVG) were not saved.`
              : "",
          );
        },
      }),
    [session],
  );

  useEffect(() => {
    const onLeave = () => void autosave.flush();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      void autosave.flush(); // saves pending edits when leaving; no dispose so StrictMode re-runs stay valid
    };
  }, [autosave]);

  const onSceneChange = useCallback(
    (elements: readonly SceneElement[], appState: unknown, files: SceneFiles) => {
      snapshot.current = { elements, appState, files };
      const signature = sceneSignature(elements, appState, files);
      if (baseline.current === null) {
        baseline.current = signature; // first callback is the loaded scene, not an edit
        return;
      }
      if (signature === baseline.current) return;
      baseline.current = signature;
      autosave.touch();
    },
    [autosave],
  );

  const rename = useCallback(
    async (title: string) => {
      await autosave.flush();
      try {
        await session.rename(title);
      } catch (error) {
        if (error instanceof BoardApiError && error.isConflict) setSaveState("conflict");
        throw error;
      }
    },
    [autosave, session],
  );

  return { saveState, errorMessage, warning, onSceneChange, rename, flush: autosave.flush };
}

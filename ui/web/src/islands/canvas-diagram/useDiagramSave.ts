// Autosave wiring of the open diagram: debounced saves with the server revision, conflict handling, rename.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardApiError } from "../../features/canvas/apiBase.ts";
import { createAutosave, type SaveState } from "../../features/canvas/autosave.ts";
import type { DiagramApi } from "../../features/diagram/api.ts";
import { createDiagramSession } from "../../features/diagram/session.ts";
import type { DiagramTheme, DiagramType } from "../../features/diagram/types.ts";

const SAVE_DELAY_MS = 1000;

interface Latest {
  source: string;
  type: DiagramType;
  theme: DiagramTheme | undefined;
}

export interface DiagramSave {
  saveState: SaveState;
  errorMessage: string;
  /** Call on every text change. */
  touch: (source: string, type: DiagramType, theme?: DiagramTheme) => void;
  rename: (title: string) => Promise<void>;
  /** "Manter a minha": adopts the server revision and saves the local text over it. */
  keepMine: () => Promise<void>;
}

export function useDiagramSave(api: DiagramApi, id: string, startRev: number): DiagramSave {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const latest = useRef<Latest | null>(null);
  const session = useMemo(() => createDiagramSession(api, id, { rev: startRev }), [api, id, startRev]);

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
          const next = latest.current;
          if (next) await session.save(next.source, next.type, next.theme);
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

  const touch = useCallback(
    (source: string, type: DiagramType, theme?: DiagramTheme) => {
      latest.current = { source, type, theme };
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

  const keepMine = useCallback(async () => {
    const board = await api.get(id);
    session.adopt(board.rev);
    autosave.resume();
    autosave.touch();
  }, [api, id, session, autosave]);

  return { saveState, errorMessage, touch, rename, keepMine };
}

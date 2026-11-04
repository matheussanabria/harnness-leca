// Debounced autosave with optimistic concurrency (`rev`). A 409 stops saving and raises a conflict.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type MindmapApi } from "./api.ts";
import { toData } from "./serialize.ts";
import type { MindDoc } from "./types.ts";

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
export const AUTOSAVE_MS = 800;

export function useAutosave(api: MindmapApi, boardId: string, initialRev: number, doc: MindDoc) {
  const [state, setState] = useState<SaveState>("saved");
  const rev = useRef(initialRev);
  const lastSaved = useRef(doc);
  const latest = useRef(doc);
  latest.current = doc;
  const stateRef = useRef<SaveState>("saved");
  const pending = useRef(false);
  const set = (next: SaveState) => {
    stateRef.current = next;
    setState(next);
  };

  const flush = useCallback(async () => {
    const snapshot = latest.current;
    if (snapshot === lastSaved.current || stateRef.current === "conflict") return;
    if (stateRef.current === "saving") {
      pending.current = true; // never send two saves with the same rev; retry once this one ends
      return;
    }
    set("saving");
    try {
      const board = await api.save(boardId, rev.current, toData(snapshot));
      rev.current = board.rev;
      lastSaved.current = snapshot;
      set(latest.current === snapshot ? "saved" : "dirty");
    } catch (error) {
      set(error instanceof ApiError && error.isConflict ? "conflict" : "error");
    }
    if (pending.current) {
      pending.current = false;
      void flush();
    }
  }, [api, boardId]);

  useEffect(() => {
    if (doc === lastSaved.current || stateRef.current === "conflict") return;
    if (stateRef.current !== "saving") set("dirty");
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, flush]);

  /** After reloading the board from the server: adopt its rev and document as the saved baseline. */
  const rebase = useCallback((nextRev: number, nextDoc: MindDoc) => {
    rev.current = nextRev;
    lastSaved.current = nextDoc;
    set("saved");
  }, []);

  return { state, flush, rebase };
}

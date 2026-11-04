// Board list state: loading, error, empty and success, plus create, rename and delete actions.
import { useCallback, useEffect, useState } from "react";
import type { BoardApi } from "../../features/board/api";
import type { BoardSummary } from "../../features/board/types";

export type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; boards: BoardSummary[] };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useBoardList(api: BoardApi) {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [actionError, setActionError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setState({ status: "ready", boards: await api.list() });
    } catch (error) {
      setState({ status: "error", message: messageOf(error) });
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Runs a mutation, then refreshes; failures surface in `actionError`. Returns true on success. */
  const act = useCallback(
    async (task: () => Promise<unknown>) => {
      setActionError("");
      try {
        await task();
      } catch (error) {
        setActionError(messageOf(error));
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return {
    state,
    actionError,
    retry: () => {
      setState({ status: "loading" });
      void refresh();
    },
    create: (title: string) => act(async () => api.create(title)),
    rename: async (board: BoardSummary, title: string) =>
      act(async () => api.update(board.id, { rev: board.rev, title })),
    remove: (id: string) => act(() => api.remove(id)),
  };
}

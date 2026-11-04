// Island entry for #/canvas-mindmap[/<boardId>]: the board list, or one board loaded in the editor.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Board, createMindmapApi } from "../../features/mindmap/api.ts";
import { EmptyPane } from "../../shared/EmptyPane.tsx";
import type { IslandProps } from "../../shared/island.ts";
import { BoardList } from "./BoardList.tsx";
import { MindmapEditor } from "./MindmapEditor.tsx";
import "./mindmap.css";

const LIST_HASH = "#/canvas-mindmap";
const boardHash = (id: string) => `${LIST_HASH}/${encodeURIComponent(id)}`;

/** Changes the address bar; the legacy shell remounts the island on every hash route change. */
function go(hash: string) {
  if (window.location.hash !== hash) window.location.hash = hash;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Could not load the board";
}

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board };

export function MindmapIsland({ slug, params, embedded = false }: IslandProps) {
  const api = useMemo(() => createMindmapApi(slug), [slug]);
  // Embedded in the Design workspace the side catalog picks the board (params[0]); standalone it comes from the hash.
  const boardId = params[0] ?? null;
  const [load, setLoad] = useState<Load>(boardId ? { status: "loading" } : { status: "idle" });

  const loadBoard = useCallback(
    (id: string, isCancelled: () => boolean = () => false) => {
      setLoad({ status: "loading" });
      api.get(id).then(
        (board) => {
          if (!isCancelled()) setLoad({ status: "ready", board });
        },
        (error: unknown) => {
          if (!isCancelled()) setLoad({ status: "error", message: messageOf(error) });
        },
      );
    },
    [api],
  );

  useEffect(() => {
    if (!boardId) {
      setLoad({ status: "idle" });
      return;
    }
    let cancelled = false;
    loadBoard(boardId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [boardId, loadBoard]);

  const open = useCallback((id: string) => go(boardHash(id)), []);
  const close = useCallback(() => go(LIST_HASH), []);
  const retry = () => {
    if (boardId) loadBoard(boardId);
  };

  return (
    <main
      className={`mm-island ${boardId === null ? "mm-island--list" : "mm-island--editor"}${embedded ? " mm-island--embedded" : ""}`}
      aria-busy={load.status === "loading"}
    >
      {boardId === null && !embedded ? <BoardList api={api} onOpen={open} /> : null}
      {boardId === null && embedded ? (
        <EmptyPane
          icon="fa-sitemap"
          title="Nenhum mapa mental aberto"
          hint="Escolha um mapa no catálogo ou crie um novo."
        />
      ) : null}
      {load.status === "loading" ? (
        <p role="status">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading board
        </p>
      ) : null}
      {load.status === "error" ? (
        <div className="mm-banner mm-banner--error" role="alert">
          <p>
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {load.message}
          </p>
          <button type="button" className="mm-btn" onClick={retry}>
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Retry
          </button>
          {embedded ? null : (
            <button type="button" className="mm-btn" onClick={close}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to boards
            </button>
          )}
        </div>
      ) : null}
      {load.status === "ready" ? (
        <MindmapEditor api={api} board={load.board} onClose={embedded ? undefined : close} />
      ) : null}
    </main>
  );
}

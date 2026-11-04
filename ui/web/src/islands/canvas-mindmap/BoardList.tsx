// Board list with create and delete. Opening a board is a route change (deep-linkable).
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { BoardSummary, MindmapApi } from "../../features/mindmap/api.ts";
import { toData } from "../../features/mindmap/serialize.ts";
import { createDoc } from "../../features/mindmap/tree.ts";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; boards: BoardSummary[] };

export function BoardList({ api, onOpen }: { api: MindmapApi; onOpen(id: string): void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "ready", boards: await api.list() });
    } catch (error) {
      setLoad({ status: "error", message: error instanceof Error ? error.message : "Could not load boards" });
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setFormError(null);
    try {
      const board = await api.create(name, toData(createDoc(crypto.randomUUID(), name)));
      onOpen(board.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create the board");
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setPendingDelete(null);
    try {
      await api.remove(id);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not delete the board");
    }
  };

  return (
    <section className="mm-list" aria-labelledby="mm-list-title">
      <h1 id="mm-list-title">
        <i className="fa-solid fa-diagram-project" aria-hidden="true" /> Mind maps
      </h1>
      <form className="mm-form" onSubmit={(event) => void create(event)}>
        <label htmlFor="mm-new-title">New mind map title</label>
        <input id="mm-new-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="mm-btn" disabled={busy || !title.trim()}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Create
        </button>
      </form>
      {formError ? (
        <p className="mm-banner mm-banner--error" role="alert">
          {formError}
        </p>
      ) : null}
      {load.status === "loading" ? (
        <p role="status">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading boards
        </p>
      ) : null}
      {load.status === "error" ? (
        <p className="mm-banner mm-banner--error" role="alert">
          {load.message}{" "}
          <button type="button" className="mm-btn" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      ) : null}
      {load.status === "ready" && load.boards.length === 0 ? (
        <p>No mind maps yet. Create the first one above.</p>
      ) : null}
      {load.status === "ready" && load.boards.length > 0 ? (
        <ul className="mm-boards">
          {load.boards.map((board) => (
            <li key={board.id}>
              <button type="button" className="mm-btn mm-boards__open" onClick={() => onOpen(board.id)}>
                <i className="fa-solid fa-diagram-project" aria-hidden="true" /> {board.title}
              </button>
              <time dateTime={board.updatedAt}>{new Date(board.updatedAt).toLocaleString()}</time>
              {pendingDelete === board.id ? (
                <button type="button" className="mm-btn mm-btn--danger" onClick={() => void remove(board.id)}>
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  className="mm-btn"
                  aria-label={`Delete ${board.title}`}
                  onClick={() => setPendingDelete(board.id)}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

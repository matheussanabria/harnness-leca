// Board list screen: create, open, rename and delete boards of kind "board".
import { type FormEvent, useState } from "react";
import type { BoardApi } from "../../features/board/api";
import type { BoardSummary } from "../../features/board/types";
import { NavLink, useBoardNav } from "./nav";
import { useBoardList } from "./useBoardList";

function BoardRow({
  board,
  onRename,
  onDelete,
}: {
  board: BoardSummary;
  onRename: (board: BoardSummary, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [title, setTitle] = useState(board.title);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (next && next !== board.title && !(await onRename(board, next))) return;
    setMode("view");
  }

  if (mode === "rename") {
    return (
      <li className="board-row">
        <form className="board-row__form" onSubmit={(event) => void submit(event)}>
          <input
            aria-label="New board title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="board-btn">
            <i className="fa-solid fa-check" aria-hidden="true" /> Save
          </button>
          <button type="button" className="board-btn" onClick={() => setMode("view")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" /> Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="board-row">
      <NavLink className="board-row__open" boardId={board.id}>
        <i className="fa-solid fa-pen-ruler" aria-hidden="true" /> {board.title}
        <small>Updated {new Date(board.updatedAt).toLocaleString()}</small>
      </NavLink>
      {mode === "confirm" ? (
        <span className="board-row__actions">
          <button type="button" className="board-btn board-btn--danger" onClick={() => void onDelete(board.id)}>
            <i className="fa-solid fa-trash" aria-hidden="true" /> Confirm delete
          </button>
          <button type="button" className="board-btn" onClick={() => setMode("view")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" /> Keep
          </button>
        </span>
      ) : (
        <span className="board-row__actions">
          <button
            type="button"
            className="board-btn"
            aria-label={`Rename ${board.title}`}
            onClick={() => setMode("rename")}
          >
            <i className="fa-solid fa-pen" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="board-btn"
            aria-label={`Delete ${board.title}`}
            onClick={() => setMode("confirm")}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}

export function BoardList({ api }: { api: BoardApi }) {
  const list = useBoardList(api);
  const nav = useBoardNav();
  const [title, setTitle] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (next && (await list.create(next))) setTitle("");
  }

  return (
    <section className="board-list" aria-labelledby="board-list-title">
      <header className="board-list__header">
        <h1 id="board-list-title">
          <i className="fa-solid fa-chalkboard" aria-hidden="true" /> Boards
        </h1>
        {nav.embedded ? null : (
          <a className="board-btn" href="#/chats">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to chats
          </a>
        )}
      </header>
      <form className="board-list__create" onSubmit={(event) => void onCreate(event)}>
        <label htmlFor="board-new-title">New board</label>
        <input
          id="board-new-title"
          value={title}
          maxLength={120}
          placeholder="Board title"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="board-btn" disabled={!title.trim()}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Create
        </button>
      </form>
      {list.actionError && (
        <p className="board-warning" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {list.actionError}
        </p>
      )}
      {list.state.status === "loading" && (
        <p className="board-notice" role="status">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading boards
        </p>
      )}
      {list.state.status === "error" && (
        <div className="board-notice" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {list.state.message}
          <button type="button" className="board-btn" onClick={list.retry}>
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Try again
          </button>
        </div>
      )}
      {list.state.status === "ready" && list.state.boards.length === 0 && (
        <p className="board-notice" role="status">
          <i className="fa-regular fa-folder-open" aria-hidden="true" /> No boards yet. Create the first one above.
        </p>
      )}
      {list.state.status === "ready" && list.state.boards.length > 0 && (
        <ul className="board-list__items">
          {list.state.boards.map((board) => (
            <BoardRow key={board.id} board={board} onRename={list.rename} onDelete={list.remove} />
          ))}
        </ul>
      )}
    </section>
  );
}

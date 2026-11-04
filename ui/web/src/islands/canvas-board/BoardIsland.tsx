// Canvas board island (story 19.04): `#/canvas-board` lists boards, `#/canvas-board/<id>` opens one.
// The loader remounts the island on every route change, so the route params are enough to pick the screen.
import { useMemo, useState } from "react";
import { createBoardApi } from "../../features/board/api";
import type { IslandProps } from "../../shared/island";
import { BoardEditor } from "./BoardEditor";
import { BoardList } from "./BoardList";
import { type BoardNav, BoardNavContext } from "./nav";
import "./board.css";

export function BoardIsland({ slug, params, embedded = false }: IslandProps) {
  const api = useMemo(() => createBoardApi(slug), [slug]);
  // Embedded in the Design workspace the open board is internal state: the hash must not change (it would remount us).
  const [openId, setOpenId] = useState<string | null>(null);
  const id = embedded ? openId : params[0];
  const nav = useMemo<BoardNav>(
    () => ({ embedded, open: (value) => setOpenId(value), close: () => setOpenId(null) }),
    [embedded],
  );
  return (
    <BoardNavContext.Provider value={nav}>
      <div className={embedded ? "board-island board-island--embedded" : "board-island"}>
        {id ? <BoardEditor api={api} id={id} /> : <BoardList api={api} />}
      </div>
    </BoardNavContext.Provider>
  );
}

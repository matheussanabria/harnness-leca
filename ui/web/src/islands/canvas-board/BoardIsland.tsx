// Canvas board island (story 19.04): `#/canvas-board` lists boards, `#/canvas-board/<id>` opens one.
// The loader remounts the island on every route change, so the route params are enough to pick the screen.
import { useMemo } from "react";
import { createBoardApi } from "../../features/board/api";
import type { IslandProps } from "../../shared/island";
import { BoardEditor } from "./BoardEditor";
import { BoardList } from "./BoardList";
import "./board.css";

export function BoardIsland({ slug, params }: IslandProps) {
  const api = useMemo(() => createBoardApi(slug), [slug]);
  const id = params[0];
  return <div className="board-island">{id ? <BoardEditor api={api} id={id} /> : <BoardList api={api} />}</div>;
}

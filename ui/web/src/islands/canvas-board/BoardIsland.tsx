// Canvas board island (story 19.04): `#/canvas-board` lists boards, `#/canvas-board/<id>` opens one.
// The loader remounts the island on every route change, so the route params are enough to pick the screen.
import { useMemo } from "react";
import { createBoardApi } from "../../features/board/api";
import { EmptyPane } from "../../shared/EmptyPane";
import type { IslandProps } from "../../shared/island";
import { BoardEditor } from "./BoardEditor";
import { BoardList } from "./BoardList";
import { type BoardNav, BoardNavContext } from "./nav";
import "./board.css";

export function BoardIsland({ slug, params, embedded = false }: IslandProps) {
  const api = useMemo(() => createBoardApi(slug), [slug]);
  // Embedded in the Design workspace the side catalog picks the board (params[0]); standalone it comes from the hash.
  const id = params[0];
  const nav = useMemo<BoardNav>(() => ({ embedded }), [embedded]);
  return (
    <BoardNavContext.Provider value={nav}>
      <div className={embedded ? "board-island board-island--embedded" : "board-island"}>
        {id ? <BoardEditor api={api} id={id} /> : null}
        {!id && !embedded ? <BoardList api={api} /> : null}
        {!id && embedded ? (
          <EmptyPane
            icon="fa-chalkboard"
            title="Nenhum quadro aberto"
            hint="Escolha um quadro no catálogo ou crie um novo."
          />
        ) : null}
      </div>
    </BoardNavContext.Provider>
  );
}

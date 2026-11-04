// Entry of the `canvas-board` island, mounted by the legacy loader on `#/canvas-board[/<boardId>]`.
// Excalidraw is NOT imported here: it loads lazily from ExcalidrawCanvas to keep this entry small.
import { createIsland } from "../../shared/island";
import { BoardIsland } from "./BoardIsland";

export const mount = createIsland(BoardIsland);

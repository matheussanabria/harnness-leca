// Entry of the `canvas-diagram` island, mounted by the legacy loader on `#/canvas-diagram[/<boardId>]`.
// Mermaid is NOT imported here: features/diagram/{render,validate}.ts load it with a dynamic import on first use.
import { createIsland } from "../../shared/island";
import { DiagramIsland } from "./DiagramIsland";

export const mount = createIsland(DiagramIsland);

// Entry of the `canvas-mindmap` island, mounted by the legacy loader on #/canvas-mindmap[/<boardId>].
import { createIsland } from "../../shared/island.ts";
import { MindmapIsland } from "./MindmapIsland.tsx";

export const mount = createIsland(MindmapIsland);

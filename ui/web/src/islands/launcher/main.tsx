// Entry of the `launcher` island, mounted by the legacy loader into #launcherRoot on /funcionalidades.
import { createIsland } from "../../shared/island";
import { LauncherIsland } from "./LauncherIsland";

export const mount = createIsland(LauncherIsland);

// Entry of the `lab` island, mounted by the legacy loader on the hidden route #/lab.
import { createIsland } from "../../shared/island";
import { LabIsland } from "./LabIsland";

export const mount = createIsland(LabIsland);

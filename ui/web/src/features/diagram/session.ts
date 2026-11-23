// Save session of one open diagram (EP-21.04): keeps the revision the server expects, so a stale tab gets a 409
// (conflict) instead of overwriting newer work. Pure over an injected API.
import type { DiagramApi } from "./api.ts";
import { createDiagramData } from "./data.ts";
import type { DiagramTheme, DiagramType } from "./types.ts";

export interface DiagramSession {
  save(source: string, type: DiagramType, theme?: DiagramTheme): Promise<void>;
  rename(title: string): Promise<void>;
  rev(): number;
  /** Takes the server's current revision, used when the person chooses to keep their text after a conflict. */
  adopt(rev: number): void;
}

export function createDiagramSession(api: DiagramApi, id: string, start: { rev: number }): DiagramSession {
  let rev = start.rev;
  return {
    async save(source, type, theme) {
      const board = await api.update(id, { rev, data: createDiagramData(source, type, theme) });
      rev = board.rev;
    },
    async rename(title) {
      const board = await api.update(id, { rev, title });
      rev = board.rev;
    },
    rev: () => rev,
    adopt(next) {
      rev = next;
    },
  };
}

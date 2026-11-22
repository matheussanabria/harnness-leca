// Typed client for the Canvas endpoints of diagram boards (kind "diagram"). Same shape as the board client, built on
// features/canvas/apiBase.ts. Fetch is injectable for tests.
import { createCanvasHttp, type FetchLike } from "../canvas/apiBase.ts";
import type { DiagramBoard, DiagramData, DiagramSummary } from "./types.ts";

export interface DiagramApi {
  list(): Promise<DiagramSummary[]>;
  create(title: string, data?: DiagramData): Promise<DiagramBoard>;
  get(id: string): Promise<DiagramBoard>;
  update(id: string, patch: { rev: number; title?: string; data?: DiagramData }): Promise<DiagramBoard>;
  remove(id: string): Promise<void>;
}

export function createDiagramApi(project: string, fetchImpl?: FetchLike): DiagramApi {
  const { base, query, one, json, send } = createCanvasHttp(project, fetchImpl);
  return {
    async list() {
      const result = await json<{ boards: DiagramSummary[] }>(`${base}?${query}`);
      return result.boards.filter((board) => board.kind === "diagram");
    },
    async create(title, data) {
      const body = data === undefined ? { kind: "diagram", title } : { kind: "diagram", title, data };
      return (await json<{ board: DiagramBoard }>(`${base}?${query}`, send("POST", body))).board;
    },
    async get(id) {
      return (await json<{ board: DiagramBoard }>(one(id))).board;
    },
    async update(id, patch) {
      return (await json<{ board: DiagramBoard }>(one(id), send("PUT", patch))).board;
    },
    async remove(id) {
      // The server applies its same-origin rule to every write and expects a JSON content type, even without a body.
      await json<{ ok: true }>(one(id), { method: "DELETE", headers: { "Content-Type": "application/json" } });
    },
  };
}

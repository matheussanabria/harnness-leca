// Typed client for the Canvas board endpoints (stories 16.01 and 16.02). Fetch is injectable for tests.
import { BoardApiError, createCanvasHttp, type FetchLike } from "../canvas/apiBase.ts";
import type { AssetInfo, Board, BoardSummary } from "./types";

// FetchLike, BoardApiError and the request helpers live in ../canvas/apiBase.ts since EP-21.03 (shared with the diagram client).
export { BoardApiError, type FetchLike };

export interface BoardApi {
  list(): Promise<BoardSummary[]>;
  create(title: string, data?: unknown): Promise<Board>;
  get(id: string): Promise<Board>;
  update(id: string, patch: { rev: number; title?: string; data?: unknown }): Promise<Board>;
  remove(id: string): Promise<void>;
  uploadAsset(id: string, bytes: Blob | Uint8Array, name: string): Promise<AssetInfo>;
  assetUrl(id: string, file: string): string;
}

export function createBoardApi(project: string, fetchImpl?: FetchLike): BoardApi {
  const { base, query, one, json, send } = createCanvasHttp(project, fetchImpl);

  return {
    async list() {
      const result = await json<{ boards: BoardSummary[] }>(`${base}?${query}`);
      return result.boards.filter((board) => board.kind === "board");
    },
    async create(title, data) {
      const body = data === undefined ? { kind: "board", title } : { kind: "board", title, data };
      return (await json<{ board: Board }>(`${base}?${query}`, send("POST", body))).board;
    },
    async get(id) {
      return (await json<{ board: Board }>(one(id))).board;
    },
    async update(id, patch) {
      return (await json<{ board: Board }>(one(id), send("PUT", patch))).board;
    },
    async remove(id) {
      // The server applies its same-origin rule to every write and expects a JSON content type, even without a body.
      await json<{ ok: true }>(one(id), { method: "DELETE", headers: { "Content-Type": "application/json" } });
    },
    async uploadAsset(id, bytes, name) {
      const url = `${base}/${encodeURIComponent(id)}/assets?${query}&name=${encodeURIComponent(name)}`;
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: bytes as BodyInit,
      };
      return (await json<{ asset: AssetInfo }>(url, init)).asset;
    },
    assetUrl(id, file) {
      return `${base}/${encodeURIComponent(id)}/assets/${encodeURIComponent(file)}?${query}`;
    },
  };
}

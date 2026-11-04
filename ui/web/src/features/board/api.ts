// Typed client for the Canvas board endpoints (stories 16.01 and 16.02). Fetch is injectable for tests.
import type { AssetInfo, Board, BoardSummary } from "./types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class BoardApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentRev: number | null;

  constructor(message: string, status: number, code: string, currentRev: number | null = null) {
    super(message);
    this.name = "BoardApiError";
    this.status = status;
    this.code = code;
    this.currentRev = currentRev;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

async function failure(response: Response): Promise<BoardApiError> {
  let body: { error?: unknown; code?: unknown; currentRev?: unknown } = {};
  try {
    body = ((await response.json()) as typeof body) ?? {};
  } catch {
    // Non-JSON error bodies keep the generic message.
  }
  const message = typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
  const code = typeof body.code === "string" ? body.code : "HTTP_ERROR";
  const rev = typeof body.currentRev === "number" ? body.currentRev : null;
  return new BoardApiError(message, response.status, code, rev);
}

export interface BoardApi {
  list(): Promise<BoardSummary[]>;
  create(title: string, data?: unknown): Promise<Board>;
  get(id: string): Promise<Board>;
  update(id: string, patch: { rev: number; title?: string; data?: unknown }): Promise<Board>;
  remove(id: string): Promise<void>;
  uploadAsset(id: string, bytes: Blob | Uint8Array, name: string): Promise<AssetInfo>;
  assetUrl(id: string, file: string): string;
}

export function createBoardApi(project: string, fetchImpl: FetchLike = (url, init) => fetch(url, init)): BoardApi {
  const query = `project=${encodeURIComponent(project)}`;
  const base = "/api/canvas/boards";
  const one = (id: string) => `${base}/${encodeURIComponent(id)}?${query}`;

  async function json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(url, init);
    if (!response.ok) throw await failure(response);
    return (await response.json()) as T;
  }

  const send = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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

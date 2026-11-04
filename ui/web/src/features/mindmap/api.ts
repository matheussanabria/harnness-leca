// Typed client for the Canvas REST API (GET/POST /api/canvas/boards, GET/PUT/DELETE /api/canvas/boards/:id).
export interface BoardSummary {
  id: string;
  title: string;
  kind: string;
  rev: number;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  data: unknown;
}

/** Thrown for non-2xx answers; `currentRev` is set on 409 revision conflicts. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentRev?: number;
  constructor(message: string, status: number, code: string, currentRev?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.currentRev = currentRev;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
}

type Fetcher = typeof fetch;

async function call<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.code === "string" ? body.code : "HTTP_ERROR";
    const message = typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new ApiError(
      message,
      response.status,
      code,
      typeof body.currentRev === "number" ? body.currentRev : undefined,
    );
  }
  return body as T;
}

export function createMindmapApi(project: string, fetcher: Fetcher = (...args) => fetch(...args)) {
  const q = `project=${encodeURIComponent(project)}`;
  const one = (id: string) => `/api/canvas/boards/${encodeURIComponent(id)}?${q}`;
  return {
    async list(): Promise<BoardSummary[]> {
      const { boards } = await call<{ boards: BoardSummary[] }>(fetcher, `/api/canvas/boards?${q}`);
      return boards.filter((board) => board.kind === "mindmap");
    },
    async create(title: string, data: unknown): Promise<Board> {
      const body = JSON.stringify({ kind: "mindmap", title, data });
      return (await call<{ board: Board }>(fetcher, `/api/canvas/boards?${q}`, { method: "POST", body })).board;
    },
    async get(id: string): Promise<Board> {
      return (await call<{ board: Board }>(fetcher, one(id))).board;
    },
    async save(id: string, rev: number, data: unknown, title?: string): Promise<Board> {
      const body = JSON.stringify(title === undefined ? { rev, data } : { rev, data, title });
      return (await call<{ board: Board }>(fetcher, one(id), { method: "PUT", body })).board;
    },
    async remove(id: string): Promise<void> {
      await call<unknown>(fetcher, one(id), { method: "DELETE" });
    },
  };
}

export type MindmapApi = ReturnType<typeof createMindmapApi>;

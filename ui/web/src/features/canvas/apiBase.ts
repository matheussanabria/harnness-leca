// Shared plumbing of the typed Canvas clients (extracted in EP-21.03 from features/board/api.ts, as the story asked,
// because the diagram client needs the same error type and request helpers). Fetch is injectable for tests.

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

export async function failure(response: Response): Promise<BoardApiError> {
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

export interface CanvasHttp {
  query: string;
  base: string;
  one(id: string): string;
  json<T>(url: string, init?: RequestInit): Promise<T>;
  send(method: string, body: unknown): RequestInit;
}

/** URL helpers and JSON request helper for `/api/canvas/boards` scoped to one project. */
export function createCanvasHttp(project: string, fetchImpl: FetchLike = (url, init) => fetch(url, init)): CanvasHttp {
  const query = `project=${encodeURIComponent(project)}`;
  const base = "/api/canvas/boards";
  return {
    query,
    base,
    one: (id) => `${base}/${encodeURIComponent(id)}?${query}`,
    async json<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await fetchImpl(url, init);
      if (!response.ok) throw await failure(response);
      return (await response.json()) as T;
    },
    send: (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  };
}

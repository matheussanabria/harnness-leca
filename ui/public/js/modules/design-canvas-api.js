// @ts-check
// Canvas REST client for the Design workspace catalog (plain ES module, no bundler).

/** Error thrown for a non-OK canvas answer; keeps the HTTP status for conflict retries. */
class CanvasApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   */
  constructor(message, status, code) {
    super(message);
    this.name = "CanvasApiError";
    this.status = status;
    this.code = code || "";
  }
}

/**
 * Starter document per kind, with a fresh root id for mind maps.
 * @param {string} kind
 * @param {string} title
 */
function starter(kind, title) {
  if (kind === "mindmap") {
    const rootId = crypto.randomUUID();
    return {
      schema: "mindmap@1",
      rootId,
      nodes: [{ id: rootId, text: title, children: [], collapsed: false }],
    };
  }
  return { schema: "excalidraw@1", elements: [], appState: {}, files: {} };
}

/**
 * Build the client for one project.
 * @param {string} slug
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [fetcher]
 */
export function createCanvasApi(slug, fetcher = fetch) {
  const q = `project=${encodeURIComponent(slug)}`;
  const base = "/api/canvas/boards";
  /** @param {string} id */
  const one = (id) => `${base}/${encodeURIComponent(id)}?${q}`;

  /** @param {string} url @param {RequestInit} [init] */
  async function call(url, init = {}) {
    // The server requires a JSON Content-Type on every canvas request.
    const response = await fetcher(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const message = typeof data.error === "string"
        ? data.error
        : `Falha na requisição (${response.status})`;
      throw new CanvasApiError(message, response.status, data.code);
    }
    return data;
  }

  /**
   * PUT the title plus the board's current data and rev.
   * @param {string} id
   * @param {string} title
   * @param {{ rev: number, data: unknown }} current
   */
  async function putTitle(id, title, current) {
    const body = JSON.stringify({ title, data: current.data, rev: current.rev });
    return (await call(one(id), { method: "PUT", body })).board;
  }

  return {
    /**
     * Boards of one kind only, newest updatedAt first.
     * @param {string} kind
     */
    async list(kind) {
      const data = await call(`${base}?${q}`);
      const boards = Array.isArray(data.boards) ? data.boards : [];
      return boards
        .filter((board) => board.kind === kind)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },

    /**
     * Create a board with its starter document; returns the created board.
     * @param {string} kind
     * @param {string} title
     */
    async create(kind, title) {
      const body = JSON.stringify({ kind, title, data: starter(kind, title) });
      return (await call(`${base}?${q}`, { method: "POST", body })).board;
    },

    /**
     * Read the board, then PUT the same data with the new title and its rev.
     * Retries once on a 409 with the fresh rev.
     * @param {string} id
     * @param {string} title
     */
    async rename(id, title) {
      const current = (await call(one(id))).board;
      try {
        return await putTitle(id, title, current);
      } catch (error) {
        if (error instanceof CanvasApiError && error.status === 409) {
          const fresh = (await call(one(id))).board;
          return putTitle(id, title, fresh);
        }
        throw error;
      }
    },

    /** @param {string} id */
    async remove(id) {
      await call(one(id), { method: "DELETE" });
    },
  };
}
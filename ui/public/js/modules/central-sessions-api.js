// @ts-check
// Cliente de leitura da Central de Sessões (EP-09.03).
// Consome o read model congelado em 10-contrato-leitura-central.md.
// Enquanto a 09.02 (event log e SSE) não fecha, existe um adaptador determinístico
// para o desenho da interface — nunca ativado como padrão em produção.

/**
 * @typedef {Object} SessionClient
 * @property {(slug: string, filters?: object) => Promise<object>} listSessions
 * @property {(slug: string, id: string) => Promise<object|null>} getSession
 */

/**
 * @param {object} [options]
 * @param {string} [options.baseUrl=""]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {SessionClient}
 */
export function createHttpSessionClient(options = {}) {
  const baseUrl = options.baseUrl || "";
  const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch : null);

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function request(url) {
    if (!fetchImpl) throw new Error("Sem transporte HTTP disponível.");
    const res = await fetchImpl(`${baseUrl}${url}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Falha ao consultar ${url} (${res.status}).`);
    return res.json();
  }

  return {
    async listSessions(slug, filters = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && String(value) !== "") params.set(key, String(value));
      }
      const query = params.toString();
      return request(`/api/project/${encodeURIComponent(slug)}/sessions${query ? `?${query}` : ""}`);
    },
    async getSession(slug, id) {
      try {
        return await request(`/api/project/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(id)}`);
      } catch {
        return null;
      }
    },
  };
}

/**
 * Adaptador determinístico para desenho e teste da interface.
 * @param {object[]} sessions
 * @returns {SessionClient}
 */
export function createMockSessionClient(sessions = []) {
  return {
    async listSessions(_slug, filters = {}) {
      const { matchesFilters } = await import("./central-sessions-model.js");
      const selected = sessions.filter((session) => matchesFilters(session, filters));
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        sessions: selected,
        attention: { count: selected.filter((s) => s.attentionStatus === "open").length, bySeverity: { high: 0, medium: 0, low: 0 } },
        totals: { total: selected.length },
        warnings: [],
        cursor: "",
        source: "mock",
      };
    },
    async getSession(_slug, id) {
      const found = sessions.find((session) => session.id === id);
      return found ? { session: found } : null;
    },
  };
}

// @ts-check
// Network layer of the office Scrum board: thin wrappers over the existing Scrum routes. Never throws: returns { ok, data | error }.

/** The office user is a human; the server records this as a claim, not a verified identity. */
export const OFFICE_ACTOR = "human:office";

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} method
 * @param {string} url
 * @param {any} [body]
 * @returns {Promise<{ ok: true, data: any } | { ok: false, status: number, error: string }>}
 */
async function call(fetchImpl, method, url, body) {
  try {
    const res = await fetchImpl(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    /** @type {any} */
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) return { ok: false, status: res.status, error: data?.error || `Falha HTTP ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: "Servico de Scrum indisponivel." };
  }
}

/**
 * @param {string} slug
 * @param {typeof fetch} [fetchImpl]
 */
export function createScrumApi(slug, fetchImpl = fetch.bind(globalThis)) {
  const base = `/api/project/${encodeURIComponent(slug)}/scrum`;
  const enc = encodeURIComponent;
  return {
    load: () => call(fetchImpl, "GET", base),
    move: (/** @type {string} */ storyId, /** @type {string} */ fromLaneId, /** @type {string} */ toLaneId) =>
      call(fetchImpl, "POST", `${base}/story/transition`, { storyId, fromLaneId, toLaneId, actor: OFFICE_ACTOR }),
    startSprint: (/** @type {string} */ sprintId) =>
      call(fetchImpl, "POST", `${base}/sprint/${enc(sprintId)}/start`, { actor: OFFICE_ACTOR }),
    closeSprint: (/** @type {string} */ sprintId, /** @type {{ carryOver: string, nextSprintId?: string }} */ options) =>
      call(fetchImpl, "POST", `${base}/sprint/${enc(sprintId)}/close`, { actor: OFFICE_ACTOR, ...options }),
    setImpediment: (/** @type {string} */ storyId, /** @type {boolean} */ active, /** @type {string} */ reason) =>
      call(fetchImpl, "POST", `${base}/story/impediment`, { storyId, active, reason }),
    async trace(/** @type {string} */ storyId) {
      const [dor, commits] = await Promise.all([
        call(fetchImpl, "GET", `${base}/story/${enc(storyId)}/dor`),
        call(fetchImpl, "GET", `${base}/story/${enc(storyId)}/commits`),
      ]);
      if (!dor.ok) return dor;
      if (!commits.ok) return commits;
      return { ok: /** @type {const} */ (true), data: { maturity: dor.data.maturity, dor: dor.data.dor, commits: commits.data } };
    },
  };
}

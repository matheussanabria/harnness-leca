// @ts-check
// Header presence strip: which engines are working right now (Claude, Gemini, OpenCode).
// Read-only GET /api/agents/active, polled while the tab is visible. A failed read shows "n/d", never idle.

const POLL_MS = 10000;
const ENGINES = [
  { id: "claude", label: "Claude", icon: "fa-asterisk" },
  { id: "gemini", label: "Gemini", icon: "fa-gem" },
  { id: "opencode", label: "OpenCode", icon: "fa-terminal" },
];

/** @param {unknown} v @returns {string} */
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * @param {any} summary response of /api/agents/active, or null when the read failed
 * @returns {string}
 */
export function renderPresenceStrip(summary) {
  const items = ENGINES.map((e) => {
    const agent = summary && summary.agents ? summary.agents[e.id] : null;
    const count = agent && Number.isFinite(agent.activeCount) ? agent.activeCount : null;
    const state = !agent ? "unknown" : agent.status === "active" ? "active" : "idle";
    const text = state === "unknown" ? "n/d" : state === "active" ? `${count || 1} ativo${count > 1 ? "s" : ""}` : "ocioso";
    const title = state === "unknown" ? `${e.label}: sem leitura` : `${e.label}: ${text}`;
    return `<span class="pres-item pres-item--${state}" title="${esc(title)}" aria-label="${esc(title)}">
      <i class="fa-solid ${e.icon}" aria-hidden="true"></i><span class="pres-name">${esc(e.label)}</span><span class="pres-dot" aria-hidden="true"></span><span class="pres-text">${esc(text)}</span></span>`;
  });
  return items.join("");
}

/**
 * @param {HTMLElement} root
 * @param {{ fetchImpl?: typeof fetch, doc?: Document, pollMs?: number }} [params]
 */
export function mountPresenceStrip(root, params = {}) {
  const f = params.fetchImpl || (typeof fetch === "function" ? fetch : null);
  const doc = params.doc || (typeof document !== "undefined" ? document : null);
  let destroyed = false;
  /** @type {AbortController | null} */ let ac = null;
  root.setAttribute("role", "status");
  root.setAttribute("aria-label", "Motores em atividade");
  root.innerHTML = renderPresenceStrip(null);

  async function refresh() {
    if (destroyed || !f || (doc && doc.hidden)) return;
    ac?.abort();
    ac = new AbortController();
    try {
      const res = await f("/api/agents/active", { headers: { Accept: "application/json" }, signal: ac.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!destroyed) root.innerHTML = renderPresenceStrip(data);
    } catch (err) {
      if (destroyed || (err instanceof Error && err.name === "AbortError")) return;
      root.innerHTML = renderPresenceStrip(null);
    }
  }

  const timer = setInterval(refresh, params.pollMs || POLL_MS);
  doc && doc.addEventListener && doc.addEventListener("visibilitychange", refresh);
  const first = refresh();
  return { first, refresh, destroy() { destroyed = true; clearInterval(timer); ac?.abort(); doc && doc.removeEventListener && doc.removeEventListener("visibilitychange", refresh); } };
}

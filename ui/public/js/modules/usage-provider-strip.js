// @ts-check
// Office Consumo tab: compact provider strip with quota gauges (read-only GET /api/usage/quotas).
// Reuses the pure quota model of the Consumo page; a failed fetch shows a short notice, never zeros.
import { buildQuotaCards } from "../consumo/consumo-model.js";
import { esc, NA } from "./usage-format.js";

const POLL_MS = 60000;
const ICONS = { claude: "fa-asterisk", codex: "fa-terminal", gemini: "fa-gem" };

/** @param {any} w */
function gauge(w) {
  const fill = w.pct === null ? "" : `<span style="width:${w.pct}%"></span>`;
  const label = w.pct === null ? NA : `${w.pct}%`;
  const flags = (w.estimated ? ' <i class="fa-solid fa-hand" title="Limite informado manualmente (estimado)" aria-label="estimado"></i>' : "")
    + (w.stale ? ' <i class="fa-solid fa-clock" title="Leitura desatualizada" aria-label="desatualizado"></i>' : "");
  const title = `${w.label}: ${w.usedText} de ${w.limitText} ${w.unit} - renova ${w.resetsText}`;
  return `<div class="ups-win" title="${esc(title)}"><span class="ups-win__name">${esc(w.label)}</span>
    <div class="ups-bar ups-bar--${w.level}" role="img" aria-label="${esc(w.label)}: ${esc(label)}">${fill}</div>
    <span class="ups-win__val">${esc(label)}${flags}</span></div>`;
}

/** @param {any[]} cards */
export function renderProviderStrip(cards) {
  if (!cards.length) return "";
  const items = cards.map((c) => {
    const icon = /** @type {Record<string, string>} */ (ICONS)[c.provider] || "fa-cube";
    const body = c.windows.length ? c.windows.map(gauge).join("") : `<span class="ups-win__val">cota ${NA}</span>`;
    return `<div class="ups-card"><div class="ups-card__head"><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(c.provider)} <small>${esc(c.plan)}</small></div>${body}</div>`;
  }).join("");
  return `<div class="ups" aria-label="Cotas por provedor">${items}<a class="ups-link" href="/consumo" target="_blank" rel="noopener">Detalhes <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></div>`;
}

/**
 * @param {HTMLElement} root
 * @param {{ fetchImpl?: typeof fetch, doc?: Document, pollMs?: number }} [params]
 */
export function mountProviderStrip(root, params = {}) {
  const f = params.fetchImpl || (typeof fetch === "function" ? fetch : null);
  const doc = params.doc || (typeof document !== "undefined" ? document : null);
  let destroyed = false;
  /** @type {AbortController | null} */ let ac = null;

  async function refresh() {
    if (destroyed || !f || (doc && doc.hidden)) return;
    ac?.abort();
    ac = new AbortController();
    try {
      const res = await f("/api/usage/quotas", { headers: { Accept: "application/json" }, signal: ac.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!destroyed) root.innerHTML = renderProviderStrip(buildQuotaCards(data));
    } catch (err) {
      if (destroyed || (err instanceof Error && err.name === "AbortError")) return;
      root.innerHTML = `<p class="usage-muted"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Cotas indisponíveis no momento.</p>`;
    }
  }

  const timer = setInterval(refresh, params.pollMs || POLL_MS);
  const first = refresh();
  return { first, refresh, destroy() { destroyed = true; clearInterval(timer); ac?.abort(); } };
}

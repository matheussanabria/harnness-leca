// @ts-check
// Consumo page controller: loads once, polls while visible, re-renders pages without refetching.
import { loadConsumo } from "./consumo-api.js";
import { buildAsOf, buildComboRows, buildGeminiRows, buildOpenCodeRows, buildQuotaCards, buildTrend } from "./consumo-model.js";
import { renderAsOf, renderCombos, renderGemini, renderOpenCode, renderQuotas, renderTrend } from "./consumo-view.js";
import { bindPagers } from "../shared/pagination.js";
import { hydratePageSizes } from "../shared/pagination-prefs.js";

const POLL_MS = 30000;

/** @param {Document} doc */
export function startConsumoPage(doc = document) {
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (doc.getElementById(id));
  const project = new URL(location.href).searchParams.get("p") || "";
  /** @type {any} */ let loaded = null;
  /** @type {AbortController | null} */ let abort = null;

  function paint() {
    if (!loaded) return;
    const q = loaded.quotas;
    $("cQuotas").innerHTML = q.ok ? renderQuotas(buildQuotaCards(q.data)) : `<p class="c-empty">${q.error}</p>`;
    $("cCombos").innerHTML = loaded.combos.ok ? renderCombos(buildComboRows(loaded.combos.data.combos)) : `<p class="c-empty">${loaded.combos.error}</p>`;
    $("cOpenCode").innerHTML = loaded.opencode.ok ? renderOpenCode(buildOpenCodeRows(loaded.opencode.data.stats)) : `<p class="c-empty">${loaded.opencode.error}</p>`;
    $("cGemini").innerHTML = loaded.gemini.ok ? renderGemini(buildGeminiRows(loaded.gemini.data.days), Boolean(loaded.gemini.data.partial)) : `<p class="c-empty">${loaded.gemini.error}</p>`;
    $("cTrend").innerHTML = renderTrend(buildTrend(loaded.trend));
    $("cAsOf").innerHTML = renderAsOf(buildAsOf(loaded));
    for (const id of ["cCombos", "cOpenCode", "cGemini"]) bindPagers($(id), paint);
  }

  async function refresh() {
    if (doc.hidden) return;
    abort?.abort();
    abort = new AbortController();
    try {
      loaded = await loadConsumo({ project, window: "14d", signal: abort.signal });
      paint();
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) throw err;
    }
  }

  $("cRefresh").addEventListener("click", refresh);
  doc.addEventListener("visibilitychange", refresh);
  setInterval(refresh, POLL_MS);
  hydratePageSizes().then(refresh, refresh);
}

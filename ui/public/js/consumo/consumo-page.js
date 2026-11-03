// @ts-check
// Consumo page controller: loads once, polls while visible, re-renders pages without refetching.
import { loadConsumo } from "./consumo-api.js";
import { buildAsOf, buildComboRows, buildFallbacks, buildGeminiRows, buildOpenCodeRows, buildQuotaCards } from "./consumo-model.js";
import { renderAsOf, renderCombos, renderGemini, renderOpenCode, renderQuotas } from "./consumo-view.js";
import { bindPagers } from "../shared/pagination.js";
import { hydratePageSizes } from "../shared/pagination-prefs.js";
import { mountUsagePanel } from "../modules/usage-panel.js";
import { ACTIVE_PROJECT_STORAGE_KEY } from "../shared/project-selection.js";

const POLL_MS = 30000;

/** Active project saved by the main app, or "". */
function readStoredProject() {
  try { return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) || ""; } catch { return ""; }
}

/** @param {Document} doc */
export function startConsumoPage(doc = document) {
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (doc.getElementById(id));
  const project = new URL(location.href).searchParams.get("p") || readStoredProject();
  /** @type {any} */ let loaded = null;
  /** @type {AbortController | null} */ let abort = null;

  function paint() {
    if (!loaded) return;
    const q = loaded.quotas;
    $("cQuotas").innerHTML = q.ok ? renderQuotas(buildQuotaCards(q.data)) : `<p class="c-empty">${q.error}</p>`;
    $("cCombos").innerHTML = loaded.combos.ok ? renderCombos(buildComboRows(loaded.combos.data.combos, loaded.routing.ok ? loaded.routing.data.combos : []), buildFallbacks(loaded.routing.ok ? loaded.routing.data : null)) : `<p class="c-empty">${loaded.combos.error}</p>`;
    $("cOpenCode").innerHTML = loaded.opencode.ok ? renderOpenCode(buildOpenCodeRows(loaded.opencode.data.stats)) : `<p class="c-empty">${loaded.opencode.error}</p>`;
    $("cGemini").innerHTML = loaded.gemini.ok ? renderGemini(buildGeminiRows(loaded.gemini.data.days), Boolean(loaded.gemini.data.partial)) : `<p class="c-empty">${loaded.gemini.error}</p>`;
    $("cAsOf").innerHTML = renderAsOf(buildAsOf(loaded));
    for (const id of ["cCombos", "cOpenCode", "cGemini"]) bindPagers($(id), paint);
  }

  async function refresh() {
    if (doc.hidden) return;
    abort?.abort();
    abort = new AbortController();
    try {
      loaded = await loadConsumo({ signal: abort.signal });
      paint();
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) throw err;
    }
  }

  if (project) mountUsagePanel($("cProject"), { slug: project });
  else $("cProject").innerHTML = `<p class="c-empty">Selecione um projeto no app (ou use ?p=projeto) para ver o consumo por dia, modelo e sessão.</p>`;
  $("cRefresh").addEventListener("click", refresh);
  doc.addEventListener("visibilitychange", refresh);
  setInterval(refresh, POLL_MS);
  hydratePageSizes().then(refresh, refresh);
}

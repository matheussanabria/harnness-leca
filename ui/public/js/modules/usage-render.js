// @ts-check
// Aba Consumo: composição por estado (carregando, erro, desativado, vazio, pronto).

import { esc } from "./usage-format.js";
import {
  renderCards, renderCoverage, renderDays, renderModels, renderNotices, renderOrigin, renderSessions, renderWindowSelector,
} from "./usage-view.js";

/** @param {string} icon @param {string} text @param {string} [extra] */
function message(icon, text, extra = "") {
  return `<div class="usage-state" role="status"><i class="fa-solid ${icon}" aria-hidden="true"></i><p>${esc(text)}</p>${extra}</div>`;
}

/**
 * @param {{ status: "loading" | "error" | "ready", window: string, error?: string, vm?: any }} state
 * @returns {string}
 */
export function renderUsagePanel(state) {
  const head = `<h3 class="usage-title"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Consumo</h3>${renderWindowSelector(state.window)}`;
  let body;
  if (state.status === "loading") {
    body = message("fa-spinner fa-spin", "Carregando consumo...");
  } else if (state.status === "error") {
    const retry = `<button type="button" class="usage-refresh-btn" data-usage-retry><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Tentar novamente</button>`;
    body = `<div class="usage-state usage-state--error" role="alert"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>${esc(state.error || "Não foi possível carregar o consumo.")}</p>${retry}</div>`;
  } else {
    const vm = state.vm;
    if (vm.status === "disabled") body = renderNotices(vm) + message("fa-plug-circle-xmark", "A ingestão de uso está desativada neste servidor. Nenhum consumo é coletado.");
    else if (vm.status === "empty") body = renderNotices(vm) + message("fa-inbox", "Nenhuma chamada registrada neste período ainda.");
    else {
      body = renderNotices(vm) + renderCards(vm.cards, vm.reasoningText) + renderOrigin(vm.origin) + renderDays(vm.days)
        + renderModels(vm.models) + renderSessions(vm.sessions) + renderCoverage(vm.coverage);
    }
  }
  return `<div class="usage-panel" aria-busy="${state.status === "loading"}">${head}${body}</div>`;
}

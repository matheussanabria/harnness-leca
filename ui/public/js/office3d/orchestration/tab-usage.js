// @ts-check
// DAI HQ — M2 Orquestração: Aba de Consumo (telemetria de uso, custo estimado)
import { mountUsagePanel } from "../../modules/usage-panel.js";

/** @type {{ destroy: () => void } | null} */
let handle = null;

/** Libera polling e requisições em voo da aba (troca de aba, re-render ou fechamento). */
export function unmountUsageTab() {
  if (handle) handle.destroy();
  handle = null;
}

/** @param {string} activeProj */
export function renderUsageTab(activeProj) {
  return `<div id="usagePanelRoot" class="usage-root" data-slug="${String(activeProj).replace(/"/g, "")}"></div>`;
}

/**
 * Sempre desmonta a instância anterior; monta só se a aba está no DOM.
 * @param {Document} [doc]
 */
export function setupUsageTab(doc = document) {
  unmountUsageTab();
  const root = doc.getElementById("usagePanelRoot");
  if (!root) return null;
  handle = mountUsagePanel(root, { slug: root.getAttribute("data-slug") || "" });
  return handle;
}

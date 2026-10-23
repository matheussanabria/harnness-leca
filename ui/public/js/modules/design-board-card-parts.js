// @ts-check
// Pedaços do cartão do quadro Kanban: selo de registro no Design System, etapa manual e linha de uso nos protótipos.
import { esc } from "../shared/dom.js";

/**
 * Selos do cabeçalho do cartão: componente registrado no DS e etapa definida manualmente.
 * @param {any} comp
 */
export function renderCardBadges(comp) {
  const registered = comp.registryId
    ? `<span title="Registrado no Design System: ${esc(comp.registryId)}" style="font-size:10px;color:#22c55e;border:1px solid rgba(34,197,94,0.35);border-radius:4px;padding:1px 5px"><i class="fa-solid fa-circle-check"></i> DS</span>`
    : "";
  const manual = comp.isOverridden
    ? '<span title="Etapa definida manualmente" style="font-size:10px;color:var(--mute)"><i class="fa-solid fa-pen"></i> manual</span>'
    : "";
  return `<div style="display:flex;gap:4px;align-items:center">${registered}${manual}</div>`;
}

/**
 * Linha de uso: em quantas telas dos protótipos o componente aparece.
 * @param {any} usage
 */
export function renderUsage(usage) {
  if (!usage) return "";
  const text = usage.screens
    ? `Em ${usage.screens} tela(s) de ${usage.prototypes} protótipo(s)`
    : "Ainda não usado em protótipos";
  return `<div class="design-card-usage" style="font-size:10.5px;color:var(--mute);margin-bottom:4px"><i class="fa-solid fa-layer-group"></i> ${esc(text)}</div>`;
}

/**
 * Barra de ferramentas do quadro: filtro, agrupamento e zoom (estado persistido na tela `board`).
 * @param {{ filter: string, groupBy: string, zoom: number }} board
 */
export function boardToolbar(board) {
  return `<div class="design-board-toolbar">
    <input type="search" class="chats-search-input" placeholder="Filtrar componente (nome, id ou seletor)..." value="${esc(board.filter)}" oninput="onBoardSearchInput(this.value)" aria-label="Filtrar componentes">
    <div class="view-mode-toggle">
      <button type="button" class="view-btn ${board.groupBy === "stage" ? "active" : ""}" onclick="setBoardGroupBy('stage')">Por etapa</button>
      <button type="button" class="view-btn ${board.groupBy === "feature" ? "active" : ""}" onclick="setBoardGroupBy('feature')">Por funcionalidade</button>
    </div>
    <div class="view-mode-toggle">
      <button type="button" class="view-btn" onclick="setBoardZoom(${board.zoom - 25})" aria-label="Reduzir zoom"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
      <span class="view-btn active">${board.zoom}%</span>
      <button type="button" class="view-btn" onclick="setBoardZoom(${board.zoom + 25})" aria-label="Aumentar zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
    </div>
  </div>`;
}

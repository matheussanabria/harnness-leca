// @ts-check
import { esc, copyToClipboard, showToast, autoGrow, $ } from "../shared/dom.js";
import { getScreenStateClient } from "../shared/screen-state.js";

const STAGE_COLUMNS = [
  { id: "prototype", title: "Protótipo" },
  { id: "extracted", title: "Extraído" },
  { id: "design_system", title: "No design system" },
  { id: "boilerplate", title: "Boilerplate" },
  { id: "implemented", title: "Implementado" },
  { id: "documented", title: "Documentado" },
];

export const BOARD_SCREEN_ID = "board";
const GROUP_BY = Object.freeze(["stage", "feature"]);
const zoomOf = (value) => Math.min(200, Math.max(25, Number(value) || 100));
const text = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");

const board = { filter: "", selectedCard: "", groupBy: "stage", zoom: 100 };
let boardComponents = [];

/** Fotografia serializável do estado atual do quadro. */
export function boardStateFromStore() {
  return {
    filter: text(board.filter, 120),
    selectedCard: text(board.selectedCard, 120),
    groupBy: GROUP_BY.includes(board.groupBy) ? board.groupBy : "stage",
    zoom: zoomOf(board.zoom),
  };
}

/** Aplica somente campos válidos e devolve `true` quando o store mudou. */
export function applyBoardState(state = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  let changed = false;
  const set = (key, value) => {
    if (board[key] === value) return;
    board[key] = value;
    changed = true;
  };

  if (typeof state.filter === "string") set("filter", text(state.filter, 120));
  if (typeof state.selectedCard === "string") set("selectedCard", text(state.selectedCard, 120));
  if (typeof state.groupBy === "string" && GROUP_BY.includes(state.groupBy)) set("groupBy", state.groupBy);
  if (state.zoom !== undefined) set("zoom", zoomOf(state.zoom));
  return changed;
}

let hydrated = false;
let hydration = null;
let pending = null;

async function hydrate() {
  if (hydrated) return false;
  if (hydration) return hydration;
  hydration = Promise.resolve()
    .then(() => getScreenStateClient().loadScreen(BOARD_SCREEN_ID))
    .catch(() => ({}))
    .then((loaded) => {
      let changed = applyBoardState(loaded);
      if (pending) changed = applyBoardState(pending) || changed;
      hydrated = true;
      hydration = null;
      return changed;
    });
  return hydration;
}

async function persist(patch) {
  const safe = patch && typeof patch === "object" ? patch : boardStateFromStore();
  applyBoardState(safe);
  pending = { ...(pending || {}), ...safe };
  await hydrate();
  const payload = boardStateFromStore();
  pending = null;
  try { return await getScreenStateClient().patchScreen(BOARD_SCREEN_ID, payload); } catch { return false; }
}

function log(acao, alvo = "") {
  try { return getScreenStateClient().logAction(BOARD_SCREEN_ID, acao, String(alvo).slice(0, 300)); } catch { return false; }
}

/**
 * Formata o bloco de contexto para envio ao chat de acordo com a metodologia de design.
 * @param {any} comp
 */
export function formatDesignContext(comp) {
  const files = comp.files || {};
  const fileLines = [];
  if (files.ds) fileLines.push(`- ds: ${files.ds}`);
  if (files.target) fileLines.push(`- target: ${files.target}`);
  if (comp.dsFolder) fileLines.push(`- pasta_ds: ${comp.dsFolder}`);

  return `<contexto-design>
componente: ${comp.name || "Componente"} (${comp.selector || "sem-seletor"})
funcionalidade: ${comp.feature || "design-system"}
etapa_atual: ${comp.stageLabel || comp.stage}
proxima_etapa: ${comp.dai?.nextStageLabel || "Concluído"}
agente_sugerido: ${comp.dai?.agentId || "frontend-engineer"}
acao_sugerida: ${comp.dai?.nextAction || "Implementar componente conforme metodologia"}
arquivos:
${fileLines.join("\n") || "- (nenhum arquivo específico vinculado)"}
</contexto-design>`;
}

/**
 * Copia o bloco delimitado <contexto-design> para o clipboard.
 * @param {any} comp
 */
export function copyDesignContext(comp) {
  const txt = formatDesignContext(comp);
  copyToClipboard(txt, `Contexto de ${comp.name} copiado!`);
}

/**
 * Insere o bloco <contexto-design> no chat ativo e alterna para ele.
 * @param {any} comp
 */
export function sendDesignContextToChat(comp) {
  const txt = formatDesignContext(comp);
  const inp = /** @type {HTMLTextAreaElement} */ ($("chatInput") || $("studioChatInput"));
  if (inp) {
    const existing = inp.value.trim();
    inp.value = existing ? `${txt}\n\n${existing}` : `${txt}\n\n`;
    autoGrow(inp);
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
    showToast(`Contexto de ${comp.name} enviado ao chat!`);
  }
}

/**
 * Renderiza um item individual do checklist, destacando marcas inferidas.
 * @param {string} label
 * @param {any} meta
 */
function renderCheckItem(label, meta = {}) {
  const isChecked = Boolean(meta.checked);
  const isInferred = Boolean(meta.inferred);
  const title = isInferred && meta.inferredFrom
    ? `Inferido de: ${meta.inferredFrom}`
    : (isChecked ? "Verificado" : "Pendente");
  const cls = `chk-item ${isChecked ? "checked" : ""} ${isInferred ? "inferred" : ""}`;
  const icon = isChecked
    ? (isInferred ? '<i class="fa-solid fa-circle-check"></i>*' : '<i class="fa-solid fa-check"></i>')
    : '<i class="fa-regular fa-circle"></i>';

  return `<span class="${cls}" title="${esc(title)}">${icon} ${esc(label)}</span>`;
}

/**
 * Renderiza um cartão individual de componente no Kanban.
 * @param {any} comp
 * @param {boolean} [isDraft]
 */
function renderDesignCard(comp, isDraft = false) {
  const chk = comp.checklist || {};
  const dai = comp.dai || {};
  const selected = board.selectedCard === comp.id;

  return `
    <div class="design-card ${isDraft ? "draft" : ""} ${selected ? "is-selected" : ""}" id="card_${esc(comp.id)}" data-card="${esc(comp.id)}" onclick="selectDesignCard('${esc(comp.id)}')">
      <div class="design-card-head">
        <div>
          <div class="design-card-title">${esc(comp.name)} ${isDraft ? '<span style="font-size:10px;background:#eab308;color:#000;padding:1px 5px;border-radius:3px;font-weight:bold">RASCUNHO</span>' : ""}</div>
          <div class="design-card-selector">&lt;${esc(comp.selector || comp.id)}&gt;</div>
        </div>
        ${comp.isOverridden ? '<span title="Etapa definida manualmente" style="font-size:10px;color:var(--mute)"><i class="fa-solid fa-pen"></i> manual</span>' : ""}
      </div>

      <div class="design-card-dai" title="Próximo passo: ${esc(dai.nextAction || "")}">
        <span><i class="fa-solid fa-robot" aria-hidden="true"></i></span>
        <span><b>${esc(dai.agentId || "agente")}:</b> ${esc(dai.nextAction || "").slice(0, 52)}...</span>
      </div>

      ${comp.alreadyExists ? `
        <div style="font-size:10.5px;color:#38bdf8;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:4px;padding:3px 6px;margin-bottom:4px" title="${esc(comp.existingPath || "")}">
          <i class="fa-solid fa-bolt"></i> Já existe no app: <code style="font-size:10px">${esc(comp.existingPath ? comp.existingPath.split("/").pop() : "")}</code>
        </div>
      ` : ""}

      <div class="design-checklist" title="Progresso da metodologia">
        ${renderCheckItem("Protótipo", chk.meta?.inPrototype || { checked: chk.inPrototype })}
        ${renderCheckItem("Extraído", chk.meta?.isExtracted || { checked: chk.isExtracted })}
        ${renderCheckItem("No DS", chk.meta?.inDesignSystem || { checked: chk.inDesignSystem })}
        ${renderCheckItem("Boilerplate", chk.meta?.hasBoilerplate || { checked: chk.hasBoilerplate })}
        ${renderCheckItem("No App", chk.meta?.isImplemented || { checked: chk.isImplemented })}
        ${renderCheckItem("Documentado", chk.meta?.isDocumented || { checked: chk.isDocumented })}
      </div>
      ${chk.hasBoilerplate && !chk.isImplemented ? '<div style="font-size:10.5px;color:var(--mute);margin-top:-2px"><i class="fa-solid fa-circle-info"></i> Ainda não aplicado ao app</div>' : ""}

      <div class="design-card-actions">
        <button type="button" class="btn-card-action" onclick='event.stopPropagation(); copyDesignCardContext(${JSON.stringify(comp)})' title="Copiar bloco <contexto-design>"><i class="fa-solid fa-clipboard"></i> Copiar</button>
        <button type="button" class="btn-card-action" onclick='event.stopPropagation(); sendDesignCardContext(${JSON.stringify(comp)})' title="Inserir no chat ativo"><i class="fa-solid fa-message"></i> No Chat</button>
      </div>
    </div>
  `;
}

function visibleComponents(components) {
  const term = board.filter.trim().toLowerCase();
  if (!term) return components;
  return components.filter((comp) => `${comp.name || ""} ${comp.selector || ""} ${comp.feature || ""}`.toLowerCase().includes(term));
}

function boardToolbar() {
  return `<div class="design-board-toolbar">
    <input type="search" class="chats-search-input" placeholder="Filtrar componente..." value="${esc(board.filter)}" oninput="onBoardSearchInput(this.value)" aria-label="Filtrar componentes">
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

/**
 * Renderiza o quadro Kanban completo.
 * @param {HTMLElement} container
 * @param {any[]} components
 * @param {any} [draftComponent]
 */
export function renderKanbanBoard(container, components = [], draftComponent = null) {
  boardComponents = components;
  const list = visibleComponents(components);
  const cardsByCol = {};
  const push = (comp, isDraft) => {
    const key = board.groupBy === "feature" ? (comp.feature || "design-system") : (comp.stage || "prototype");
    if (!cardsByCol[key]) cardsByCol[key] = [];
    cardsByCol[key].push(renderDesignCard(comp, isDraft));
  };

  if (draftComponent) push(draftComponent, true);
  for (const comp of list) push(comp, false);

  const cols = board.groupBy === "feature"
    ? Object.keys(cardsByCol).sort().map((id) => ({ id, title: id }))
    : STAGE_COLUMNS;

  const columnsHtml = cols.map((col) => {
    const cards = cardsByCol[col.id] || [];
    return `
      <div class="kanban-col" data-col="${esc(col.id)}">
        <div class="kanban-col-header">
          <span>${esc(col.title)}</span>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        <div class="kanban-cards-list">
          ${cards.length > 0 ? cards.join("") : '<div style="font-size:11px;color:var(--mute);text-align:center;padding:16px 0">Nenhum componente nesta etapa</div>'}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `${boardToolbar()}<div class="design-kanban-board" style="font-size:${board.zoom}%">${columnsHtml}</div>`;

  if (!hydrated) hydrate().then((changed) => { if (changed) rerender(); });
}

function rerender() {
  const container = $("designViewContainer");
  if (container) renderKanbanBoard(container, boardComponents, null);
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.copyDesignCardContext = copyDesignContext;
  // @ts-ignore
  window.sendDesignCardContext = sendDesignContextToChat;
  // @ts-ignore
  window.onBoardSearchInput = (value) => {
    board.filter = value;
    void persist({ filter: value });
    rerender();
  };
  // @ts-ignore
  window.setBoardGroupBy = (groupBy) => {
    board.groupBy = groupBy;
    void persist({ groupBy });
    void log("agrupamento-do-quadro", groupBy);
    rerender();
  };
  // @ts-ignore
  window.setBoardZoom = (value) => {
    board.zoom = zoomOf(value);
    void persist({ zoom: board.zoom });
    rerender();
  };
  // @ts-ignore
  window.selectDesignCard = (id) => {
    board.selectedCard = board.selectedCard === id ? "" : id;
    void persist({ selectedCard: board.selectedCard });
    rerender();
  };
}

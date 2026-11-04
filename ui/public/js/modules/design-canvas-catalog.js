// @ts-check
// Canvas catalog markup and mounting for the Design workspace (plain ES module, no bundler).
import { esc } from "../shared/dom.js";

/** Labels, icons and copy per canvas kind. */
const KINDS = {
  mindmap: {
    section: "Mapas mentais do projeto", empty: "Nenhum mapa mental no projeto.",
    icon: "fa-sitemap", badge: "Mapa", createTitle: "Novo mapa mental",
    listError: "Falha ao carregar os mapas mentais.",
  },
  board: {
    section: "Quadros do projeto", empty: "Nenhum quadro no projeto.",
    icon: "fa-chalkboard", badge: "Quadro", createTitle: "Novo quadro",
    listError: "Falha ao carregar os quadros.",
  },
};

/** @param {string} kind */
function kindInfo(kind) {
  return kind === "mindmap" ? KINDS.mindmap : KINDS.board;
}

/** Fixed pt-BR date "dd/mm/yyyy HH:MM" in UTC, so a timestamp renders the same in any timezone. @param {string} iso */
function formatUpdatedAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--";
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * @param {{ id: string, title: string, updatedAt: string }} item
 * @param {ReturnType<typeof kindInfo>} info
 * @param {{ selectedId: string, renamingId: string, confirmingId: string }} state
 */
function itemHtml(item, info, state) {
  const id = esc(item.id);
  const title = esc(item.title);
  if (item.id === state.renamingId) {
    return `
      <div class="proto-item-wrap" data-canvas-id="${id}">
        <div class="proto-item-card canvas-renaming">
          <input type="text" class="canvas-rename-input" data-canvas-rename-input="${id}" value="${title}" aria-label="Novo título" />
          <span class="canvas-item-actions">
            <button type="button" class="canvas-item-btn" data-canvas-rename-save="${id}" title="Salvar" aria-label="Salvar"><i class="fa-solid fa-check"></i></button>
            <button type="button" class="canvas-item-btn" data-canvas-rename-cancel="${id}" title="Cancelar" aria-label="Cancelar"><i class="fa-solid fa-xmark"></i></button>
          </span>
        </div>
      </div>`;
  }
  if (item.id === state.confirmingId) {
    return `
      <div class="proto-item-wrap" data-canvas-id="${id}">
        <div class="proto-item-card canvas-confirming">
          <span class="proto-item-heading"><strong>Excluir?</strong></span>
          <span class="canvas-item-actions">
            <button type="button" class="canvas-item-btn canvas-item-btn--danger" data-canvas-confirm="${id}" title="Confirmar exclusão" aria-label="Confirmar exclusão"><i class="fa-solid fa-check"></i></button>
            <button type="button" class="canvas-item-btn" data-canvas-cancel="${id}" title="Cancelar" aria-label="Cancelar"><i class="fa-solid fa-xmark"></i></button>
          </span>
        </div>
      </div>`;
  }
  const active = item.id === state.selectedId ? " active" : "";
  const detail = esc(`Atualizado ${formatUpdatedAt(item.updatedAt)}`);
  return `
    <div class="proto-item-wrap">
      <button type="button" class="proto-item-card${active}" data-canvas-id="${id}">
        <span class="proto-item-heading"><strong>${title}</strong><span class="proto-card-badge">${esc(info.badge)}</span></span>
        <span class="proto-item-detail"><i class="fa-solid ${info.icon}"></i> ${detail}</span>
      </button>
      <button type="button" class="proto-item-edit" data-canvas-edit="${id}" title="Renomear" aria-label="Renomear ${title}"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="proto-item-delete" data-canvas-delete="${id}" title="Excluir" aria-label="Excluir ${title}"><i class="fa-solid fa-trash-can"></i></button>
    </div>`;
}

/**
 * Pure list markup for the canvas boards of one kind.
 * @param {Array<{ id: string, title: string, kind: string, rev: number, updatedAt: string }>} items
 * @param {{ kind: string, selectedId?: string | null, renamingId?: string | null, confirmingId?: string | null }} options
 */
export function canvasCatalogHtml(items, options) {
  const info = kindInfo(options.kind);
  const list = Array.isArray(items) ? items : [];
  const state = { selectedId: options.selectedId || "", renamingId: options.renamingId || "", confirmingId: options.confirmingId || "" };
  const cards = list.map((item) => itemHtml(item, info, state)).join("");
  return `
    <div class="proto-catalog-list">
      <div class="proto-catalog-section-title">${esc(`${info.section} (${list.length})`)}</div>
      ${cards || `<div class="proto-catalog-empty">${esc(info.empty)}</div>`}
    </div>`;
}

/**
 * Header with a create (+) button and the shared collapse button.
 * @param {ReturnType<typeof kindInfo>} info
 */
function headerHtml(info) {
  return `
    <div class="proto-panel-header">
      <span class="proto-panel-title"><i class="fa-solid fa-shapes"></i> Catálogo</span>
      <div class="proto-panel-actions">
        <button type="button" class="proto-panel-action-btn" data-canvas-create title="${esc(info.createTitle)}" aria-label="${esc(info.createTitle)}"><i class="fa-solid fa-plus"></i></button>
        <button type="button" class="proto-panel-action-btn btn-collapse-panel" data-panel="catalog" title="Recolher catálogo"><i class="fa-solid fa-chevron-left"></i></button>
      </div>
    </div>`;
}

/**
 * Mount the catalog into `host` and wire the delegated events.
 * @param {HTMLElement} host
 * @param {{ slug: string, kind: string, getSelectedId: () => string | null, onSelect: (id: string | null) => void, onChange: (change: { type: string, id: string }) => void, api: ReturnType<import("./design-canvas-api.js").createCanvasApi> }} options
 */
export function mountCanvasCatalog(host, options) {
  const { kind, getSelectedId, onSelect, onChange, api } = options;
  const info = kindInfo(kind);
  /** @type {{ items: Array<{ id: string, title: string, kind: string, rev: number, updatedAt: string }>, error: string, renamingId: string, confirmingId: string }} */
  const state = { items: [], error: "", renamingId: "", confirmingId: "" };

  host.innerHTML = `${headerHtml(info)}<div class="canvas-catalog-body"></div>`;
  const body = /** @type {HTMLElement} */ (host.querySelector(".canvas-catalog-body"));
  /** @param {string} name @param {Element} el */
  const attr = (name, el) => String(el.getAttribute(name) || "");

  function renderList() {
    const alert = state.error ? `<div class="canvas-catalog-error" role="alert">${esc(state.error)}</div>` : "";
    body.innerHTML = alert + canvasCatalogHtml(state.items, {
      kind, selectedId: getSelectedId(), renamingId: state.renamingId, confirmingId: state.confirmingId,
    });
    if (state.renamingId) {
      const input = /** @type {HTMLInputElement | null} */ (body.querySelector(".canvas-rename-input"));
      if (input) { input.focus(); input.select(); }
    }
  }

  async function load() {
    try { state.items = await api.list(kind); state.error = ""; }
    catch (error) { state.items = []; state.error = (error instanceof Error && error.message) || info.listError; }
    renderList();
  }

  /**
   * Run an API action, refresh the list on success and show one inline alert on failure.
   * @param {() => Promise<void>} action
   */
  async function guarded(action) {
    try { await action(); state.error = ""; await load(); }
    catch (error) { state.error = (error instanceof Error && error.message) || info.listError; renderList(); }
  }

  const createBoard = () => guarded(async () => {
    const created = await api.create(kind, info.createTitle);
    onSelect(created.id);
  });

  /** @param {string} id */
  const saveRename = (id) => guarded(async () => {
    const input = /** @type {HTMLInputElement | null} */ (body.querySelector(".canvas-rename-input"));
    const title = String(input?.value || "").trim();
    if (!title) throw new Error("Informe um título.");
    await api.rename(id, title);
    state.renamingId = "";
  });

  /** @param {string} id */
  const confirmDelete = (id) => guarded(async () => {
    const wasSelected = getSelectedId() === id;
    await api.remove(id);
    state.confirmingId = "";
    onChange({ type: "deleted", id });
    if (wasSelected) onSelect(null);
  });

  /** @param {string} id */
  function startRename(id) {
    state.renamingId = id;
    state.confirmingId = "";
    state.error = "";
    renderList();
  }

  /** @param {Event} event */
  function onClick(event) {
    if (!(event.target instanceof Element)) return;
    const selector = "[data-canvas-create],[data-canvas-edit],[data-canvas-delete],[data-canvas-rename-save],[data-canvas-rename-cancel],[data-canvas-confirm],[data-canvas-cancel],[data-canvas-id]";
    const el = event.target.closest(selector);
    if (!el) return;
    if (el.hasAttribute("data-canvas-create")) return void createBoard();
    if (el.hasAttribute("data-canvas-edit")) return startRename(attr("data-canvas-edit", el));
    if (el.hasAttribute("data-canvas-delete")) { state.confirmingId = attr("data-canvas-delete", el); state.error = ""; return renderList(); }
    if (el.hasAttribute("data-canvas-rename-save")) return void saveRename(attr("data-canvas-rename-save", el));
    if (el.hasAttribute("data-canvas-rename-cancel")) { state.renamingId = ""; return renderList(); }
    if (el.hasAttribute("data-canvas-confirm")) return void confirmDelete(attr("data-canvas-confirm", el));
    if (el.hasAttribute("data-canvas-cancel")) { state.confirmingId = ""; return renderList(); }
    if (state.renamingId || state.confirmingId) return;
    onSelect(attr("data-canvas-id", el));
    renderList();
  }

  /** @param {Event} event */
  function onDoubleClick(event) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-canvas-delete], [data-canvas-edit]")) return;
    const card = event.target.closest("[data-canvas-id]");
    if (card && !state.renamingId && !state.confirmingId) startRename(attr("data-canvas-id", card));
  }

  /** @param {KeyboardEvent} event */
  function onKeydown(event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!event.target.classList.contains("canvas-rename-input")) return;
    if (event.key === "Enter") { event.preventDefault(); void saveRename(String(event.target.getAttribute("data-canvas-rename-input"))); }
    if (event.key === "Escape") { event.preventDefault(); state.renamingId = ""; renderList(); }
  }

  host.addEventListener("click", onClick);
  host.addEventListener("dblclick", onDoubleClick);
  host.addEventListener("keydown", onKeydown);
  void load();

  return {
    refresh() { return load(); },
    destroy() {
      host.removeEventListener("click", onClick);
      host.removeEventListener("dblclick", onDoubleClick);
      host.removeEventListener("keydown", onKeydown);
    },
  };
}
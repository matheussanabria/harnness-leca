// @ts-check
// Paginação genérica do escritório: funções puras (sem DOM, sem rede).
// Limita quantos itens entram no DOM de uma vez para não travar a renderização.

export const DEFAULT_PAGE_SIZE = 5;
export const PAGE_SIZE_PRESETS = Object.freeze([5, 10, 25, 50]);

/**
 * Aceita somente os tamanhos oferecidos no seletor; qualquer outro valor volta ao padrão.
 * @param {unknown} value
 * @returns {number}
 */
export function normalizePageSize(value) {
  const size = Math.floor(Number(value));
  return PAGE_SIZE_PRESETS.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

/**
 * Corrige página e tamanho de página para valores válidos.
 * @param {number} total
 * @param {number} page
 * @param {number} [pageSize]
 * @returns {{ page: number, pageSize: number, totalPages: number, start: number, end: number }}
 */
export function normalizePage(total, page, pageSize = DEFAULT_PAGE_SIZE) {
  const size = Math.max(1, Math.floor(Number(pageSize)) || DEFAULT_PAGE_SIZE);
  const count = Math.max(0, Math.floor(Number(total)) || 0);
  const totalPages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(totalPages, Math.max(1, Math.floor(Number(page)) || 1));
  const start = (current - 1) * size;
  return { page: current, pageSize: size, totalPages, start, end: Math.min(count, start + size) };
}

/**
 * Fatia a lista na página pedida.
 * @template T
 * @param {T[]} items
 * @param {number} page
 * @param {number} [pageSize]
 * @returns {{ items: T[], page: number, pageSize: number, totalPages: number, total: number, start: number, end: number }}
 */
export function paginate(items, page, pageSize = DEFAULT_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const meta = normalizePage(list.length, page, pageSize);
  return { ...meta, total: list.length, items: list.slice(meta.start, meta.end) };
}

/**
 * Números de página a exibir; "gap" marca reticências.
 * @param {number} page
 * @param {number} totalPages
 * @returns {(number | "gap")[]}
 */
export function pageWindow(page, totalPages) {
  /** @type {(number | "gap")[]} */
  const out = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

/**
 * HTML do paginador. Os botões usam `data-page` (delegação de eventos, sem onclick inline).
 * O seletor de tamanho aparece sempre que a lista passa do tamanho padrão.
 * @param {{ page: number, pageSize: number, totalPages: number, total: number, start: number, end: number }} meta
 * @param {{ label?: string, key?: string }} [options]
 * @returns {string}
 */
export function renderPager(meta, options = {}) {
  if (!meta || meta.total <= 0 || meta.total <= DEFAULT_PAGE_SIZE) return "";
  const label = options.label || "Paginação";
  const pagerKey = options.key || "";
  const key = pagerKey ? ` data-pager="${pagerKey}"` : "";
  const btn = (/** @type {number} */ target, /** @type {string} */ inner, /** @type {string} */ aria, disabled = false, active = false) =>
    `<button type="button" class="pager__btn${active ? " is-active" : ""}" data-page="${target}" aria-label="${aria}"${active ? ' aria-current="page"' : ""}${disabled ? " disabled" : ""}>${inner}</button>`;
  const numbers = pageWindow(meta.page, meta.totalPages)
    .map((p) => (p === "gap" ? `<span class="pager__gap" aria-hidden="true">...</span>` : btn(p, String(p), `Página ${p}`, false, p === meta.page)))
    .join("");
  const sizes = PAGE_SIZE_PRESETS.map(
    (size) => `<option value="${size}"${size === meta.pageSize ? " selected" : ""}>${size}</option>`,
  ).join("");
  return `
    <nav class="pager"${key} aria-label="${label}">
      <span class="pager__info">${meta.start + 1}-${meta.end} de ${meta.total}</span>
      <div class="pager__controls">
        ${btn(meta.page - 1, '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>', "Página anterior", meta.page <= 1)}
        ${numbers}
        ${btn(meta.page + 1, '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>', "Próxima página", meta.page >= meta.totalPages)}
        <label class="pager__size">
          <span class="pager__size-label">Por página</span>
          <select class="pager__select" data-page-size="${pagerKey}" aria-label="Itens por página">${sizes}</select>
        </label>
      </div>
    </nav>`;
}

/**
 * Liga os botões do paginador dentro de um container.
 * @param {ParentNode} container
 * @param {(page: number) => void} onPage
 * @param {string} [key] limita a um paginador específico (data-pager)
 * @returns {void}
 */
export function bindPager(container, onPage, key) {
  const selector = key ? `[data-pager="${key}"] [data-page]` : ".pager [data-page]";
  for (const button of Array.from(container.querySelectorAll(selector))) {
    button.addEventListener("click", () => {
      const target = Number(button.getAttribute("data-page"));
      if (Number.isFinite(target)) onPage(target);
    });
  }
}

/** @type {Map<string, number>} página atual de cada lista, por chave (vive enquanto a aba estiver aberta) */
const pageByKey = new Map();
/** @type {Map<string, number>} tamanho de página de cada lista, por chave */
const sizeByKey = new Map();
/** @type {((key: string, size: number) => void) | null} */
let pageSizeSaver = null;

/** @param {string} key @returns {number} */
export const getPage = (key) => pageByKey.get(key) || 1;

/** @param {string} key @param {number} page @returns {void} */
export const setPage = (key, page) => void pageByKey.set(key, Math.max(1, Math.floor(page) || 1));

/** @param {string} key @returns {number} */
export const getPageSize = (key) => normalizePageSize(sizeByKey.get(key) ?? DEFAULT_PAGE_SIZE);

/** @param {string} key @param {number} size @returns {void} */
export const setPageSize = (key, size) => void sizeByKey.set(key, normalizePageSize(size));

/**
 * Registra quem persiste a troca de tamanho (usado por `pagination-prefs.js`).
 * @param {((key: string, size: number) => void) | null} saver
 * @returns {void}
 */
export function setPageSizeSaver(saver) {
  pageSizeSaver = typeof saver === "function" ? saver : null;
}

/**
 * Renderiza só a página atual de uma lista, lembrando a página e o tamanho pela chave.
 * @template T
 * @param {T[]} items
 * @param {string} key
 * @param {(item: T, index: number) => string} renderItem
 * @param {{ label?: string }} [options]
 * @returns {{ html: string, pager: string, total: number }}
 */
export function pagedHtml(items, key, renderItem, options = {}) {
  const data = paginate(items, getPage(key), getPageSize(key));
  setPage(key, data.page);
  return {
    html: data.items.map((item, i) => renderItem(item, data.start + i)).join(""),
    pager: renderPager(data, { key, label: options.label }),
    total: data.total,
  };
}

/**
 * Liga todos os paginadores do container; ao trocar de página guarda a nova página e chama onChange.
 * Ao trocar o tamanho, guarda a preferência, volta para a página 1 e chama onChange.
 * @param {ParentNode} container
 * @param {(key: string, page: number) => void} onChange
 * @returns {void}
 */
export function bindPagers(container, onChange) {
  for (const nav of Array.from(container.querySelectorAll(".pager[data-pager]"))) {
    const key = nav.getAttribute("data-pager") || "";
    for (const button of Array.from(nav.querySelectorAll("[data-page]"))) {
      button.addEventListener("click", () => {
        const target = Number(button.getAttribute("data-page"));
        if (!Number.isFinite(target)) return;
        setPage(key, target);
        onChange(key, target);
      });
    }
    const select = /** @type {HTMLSelectElement | null} */ (nav.querySelector("[data-page-size]"));
    if (!select) continue;
    select.addEventListener("change", () => {
      const size = normalizePageSize(select.value);
      setPageSize(key, size);
      setPage(key, 1);
      pageSizeSaver?.(key, size);
      onChange(key, 1);
    });
  }
}

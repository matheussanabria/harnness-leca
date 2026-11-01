// @ts-check
// Paginação genérica do escritório: funções puras (sem DOM, sem rede).
// Limita quantos itens entram no DOM de uma vez para não travar a renderização.

export const DEFAULT_PAGE_SIZE = 25;

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
 * @param {{ page: number, totalPages: number, total: number, start: number, end: number }} meta
 * @param {{ label?: string, key?: string }} [options]
 * @returns {string}
 */
export function renderPager(meta, options = {}) {
  if (!meta || meta.total <= 0 || meta.totalPages <= 1) return "";
  const label = options.label || "Paginação";
  const key = options.key ? ` data-pager="${options.key}"` : "";
  const btn = (/** @type {number} */ target, /** @type {string} */ inner, /** @type {string} */ aria, disabled = false, active = false) =>
    `<button type="button" class="pager__btn${active ? " is-active" : ""}" data-page="${target}" aria-label="${aria}"${active ? ' aria-current="page"' : ""}${disabled ? " disabled" : ""}>${inner}</button>`;
  const numbers = pageWindow(meta.page, meta.totalPages)
    .map((p) => (p === "gap" ? `<span class="pager__gap" aria-hidden="true">...</span>` : btn(p, String(p), `Página ${p}`, false, p === meta.page)))
    .join("");
  return `
    <nav class="pager"${key} aria-label="${label}">
      <span class="pager__info">${meta.start + 1}-${meta.end} de ${meta.total}</span>
      <div class="pager__controls">
        ${btn(meta.page - 1, '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>', "Página anterior", meta.page <= 1)}
        ${numbers}
        ${btn(meta.page + 1, '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>', "Próxima página", meta.page >= meta.totalPages)}
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

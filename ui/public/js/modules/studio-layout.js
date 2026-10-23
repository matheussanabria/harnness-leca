// @ts-check
// Gerenciador de layout responsivo, redimensionamento (splitter) e persistência do Studio.

export const STUDIO_SIDEBAR_MIN = 300;
export const STUDIO_SIDEBAR_MAX = 850;
export const STUDIO_CANVAS_MIN = 300;
export const STUDIO_RESIZE_STEP = 16;
export const STUDIO_DEFAULT_SIDEBAR_WIDTH = 440;
export const STUDIO_STORAGE_KEY_PREFIX = "harness_studio_sidebar_width";

let studioResizerInitialized = false;

/**
 * Calcula limites dinâmicos para a barra lateral mantendo o canvas utilizável.
 * @param {number} [viewportWidth]
 * @returns {{ min: number, max: number }}
 */
export function calculateSidebarBounds(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280) {
  const max = Math.max(STUDIO_SIDEBAR_MIN, Math.min(STUDIO_SIDEBAR_MAX, viewportWidth - STUDIO_CANVAS_MIN));
  return { min: STUDIO_SIDEBAR_MIN, max };
}

/**
 * Restringe a largura aos limites permitidos do viewport.
 * @param {number} width
 * @param {number} [viewportWidth]
 * @returns {number}
 */
export function clampSidebarWidth(width, viewportWidth) {
  const { min, max } = calculateSidebarBounds(viewportWidth);
  return Math.max(min, Math.min(max, Math.round(width)));
}

/**
 * Retorna a chave de armazenamento isolada por projeto ou global.
 * @param {string} [projectSlug]
 * @returns {string}
 */
export function resolveStorageKey(projectSlug) {
  return projectSlug ? `${STUDIO_STORAGE_KEY_PREFIX}_${projectSlug}` : STUDIO_STORAGE_KEY_PREFIX;
}

/**
 * Lê a largura persistida do storage.
 * @param {Storage | null} storage
 * @param {string} [projectSlug]
 * @param {number} [defaultWidth]
 * @returns {number}
 */
export function getStoredSidebarWidth(storage, projectSlug, defaultWidth = STUDIO_DEFAULT_SIDEBAR_WIDTH) {
  if (!storage) return defaultWidth;
  const key = resolveStorageKey(projectSlug);
  const raw = storage.getItem(key) || storage.getItem(STUDIO_STORAGE_KEY_PREFIX);
  if (!raw) return defaultWidth;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultWidth;
}

/**
 * Persiste a largura no storage.
 * @param {Storage | null} storage
 * @param {number} width
 * @param {string} [projectSlug]
 */
export function saveStoredSidebarWidth(storage, width, projectSlug) {
  if (!storage) return;
  const key = resolveStorageKey(projectSlug);
  storage.setItem(key, String(width));
}

/**
 * Aplica a largura na barra lateral e sincroniza atributos ARIA no splitter.
 * @param {HTMLElement} sidebar
 * @param {HTMLElement} resizer
 * @param {number} width
 * @param {boolean} [persist]
 * @param {Storage | null} [storage]
 * @param {string} [projectSlug]
 * @returns {number}
 */
export function applySidebarWidth(sidebar, resizer, width, persist = false, storage = null, projectSlug = "") {
  const next = clampSidebarWidth(width);
  const { min, max } = calculateSidebarBounds();
  sidebar.style.width = `${next}px`;
  resizer.setAttribute("aria-valuemin", String(min));
  resizer.setAttribute("aria-valuemax", String(max));
  resizer.setAttribute("aria-valuenow", String(next));
  if (persist) {
    saveStoredSidebarWidth(storage, next, projectSlug);
  }
  return next;
}

/**
 * Inicializa o redimensionador (splitter) com suporte a Pointer Events e Teclado.
 * @param {Object} [options]
 * @param {HTMLElement} [options.resizerEl]
 * @param {HTMLElement} [options.sidebarEl]
 * @param {HTMLElement} [options.workspaceEl]
 * @param {string} [options.projectSlug]
 * @param {Storage | null} [options.storage]
 */
export function initStudioSidebarResizer(options = {}) {
  if (studioResizerInitialized && !options.resizerEl) return;
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) return;

  const resizer = options.resizerEl || doc.getElementById("studioSidebarResizer");
  const sidebar = options.sidebarEl || doc.getElementById("studioSidebar");
  const ws = options.workspaceEl || doc.getElementById("studioWorkspace");
  if (!resizer || !sidebar || !ws) return;

  studioResizerInitialized = true;
  const storage = options.storage || null;
  const projectSlug = options.projectSlug || "";

  // Restaura largura inicial em telas maiores que mobile
  const isDesktop = typeof window !== "undefined" ? window.innerWidth > 768 : true;
  if (isDesktop) {
    const initialWidth = getStoredSidebarWidth(storage, projectSlug, sidebar.getBoundingClientRect()?.width || STUDIO_DEFAULT_SIDEBAR_WIDTH);
    applySidebarWidth(sidebar, resizer, initialWidth);
  }

  let startX = 0;
  let startW = 0;
  let activePointerId = null;

  const onPointerMove = (/** @type {PointerEvent} */ e) => {
    if (activePointerId !== e.pointerId) return;
    const delta = e.clientX - startX;
    applySidebarWidth(sidebar, resizer, startW + delta);
  };

  const onPointerUp = (/** @type {PointerEvent} */ e) => {
    if (activePointerId !== e.pointerId) return;
    doc.body.classList.remove("studio-resizing");
    if (typeof resizer.releasePointerCapture === "function") {
      resizer.releasePointerCapture(e.pointerId);
    }
    activePointerId = null;
    const finalWidth = parseInt(sidebar.style.width, 10) || startW;
    applySidebarWidth(sidebar, resizer, finalWidth, true, storage, projectSlug);
  };

  resizer.addEventListener("pointerdown", (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect()?.width || STUDIO_DEFAULT_SIDEBAR_WIDTH;
    doc.body.classList.add("studio-resizing");
    if (typeof resizer.setPointerCapture === "function") {
      resizer.setPointerCapture(e.pointerId);
    }
  });

  resizer.addEventListener("pointermove", onPointerMove);
  resizer.addEventListener("pointerup", onPointerUp);
  resizer.addEventListener("pointercancel", onPointerUp);

  // Duplo clique restaura a largura padrão canônica
  resizer.addEventListener("dblclick", () => {
    applySidebarWidth(sidebar, resizer, STUDIO_DEFAULT_SIDEBAR_WIDTH, true, storage, projectSlug);
  });

  // Acessibilidade via teclado
  resizer.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
    const current = sidebar.getBoundingClientRect()?.width || STUDIO_DEFAULT_SIDEBAR_WIDTH;
    const { min, max } = calculateSidebarBounds();
    let next = null;

    if (e.key === "ArrowLeft") next = current - STUDIO_RESIZE_STEP;
    else if (e.key === "ArrowRight") next = current + STUDIO_RESIZE_STEP;
    else if (e.key === "PageDown") next = current - (STUDIO_RESIZE_STEP * 4);
    else if (e.key === "PageUp") next = current + (STUDIO_RESIZE_STEP * 4);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;

    if (next != null) {
      e.preventDefault();
      applySidebarWidth(sidebar, resizer, next, true, storage, projectSlug);
    }
  });
}

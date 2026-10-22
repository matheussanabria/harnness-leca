// @ts-check
/**
 * Gerenciador de Layout e Redimensionamento das 4 Áreas do Workspace de Protótipos.
 * Painéis: Catálogo (1), Chat IA (2), Preview Central (3) e Inspetor (4).
 */

const STORAGE_KEY = "harness_proto_workspace_layout";

const DEFAULTS = {
  widths: { catalog: 220, chat: 380, inspector: 290 },
  collapsed: { catalog: false, chat: false, inspector: false },
};

const LIMITS = {
  catalog: { min: 160, max: 340 },
  chat: { min: 280, max: 620 },
  inspector: { min: 220, max: 460 },
};

let layoutState = loadLayoutState();

function loadLayoutState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
    const parsed = JSON.parse(raw);
    return {
      widths: { ...DEFAULTS.widths, ...(parsed.widths || {}) },
      collapsed: { ...DEFAULTS.collapsed, ...(parsed.collapsed || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveLayoutState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutState));
  } catch {}
}

/**
 * Inicializa os manipuladores de drag e colapso no container do workspace.
 * @param {HTMLElement} root
 */
export function initWorkspaceLayout(root) {
  if (!root) return;

  applyAllWidths(root);

  root.querySelectorAll(".proto-resizer").forEach((resizer) => {
    const target = /** @type {HTMLElement} */ (resizer).dataset.target;
    const direction = /** @type {HTMLElement} */ (resizer).dataset.dir || "left";
    if (target) {
      setupResizer(root, /** @type {HTMLElement} */ (resizer), target, direction);
    }
  });

  root.querySelectorAll(".btn-collapse-panel").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = /** @type {HTMLElement} */ (btn).dataset.panel;
      if (panel) togglePanelCollapse(root, panel);
    });
  });

  root.querySelectorAll(".btn-expand-panel").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = /** @type {HTMLElement} */ (btn).dataset.panel;
      if (panel) togglePanelCollapse(root, panel);
    });
  });
}

/**
 * Alterna estado recolhido/expandido de um painel lateral.
 * @param {HTMLElement} root
 * @param {string} panel
 */
export function togglePanelCollapse(root, panel) {
  if (!layoutState.collapsed.hasOwnProperty(panel)) return;
  layoutState.collapsed[panel] = !layoutState.collapsed[panel];
  saveLayoutState();
  applyAllWidths(root);
}

/**
 * Define explicitamente o estado recolhido de um painel (idempotente).
 * @param {HTMLElement} root
 * @param {string} panel
 * @param {boolean} collapsed
 */
export function setPanelCollapsed(root, panel, collapsed) {
  if (!layoutState.collapsed.hasOwnProperty(panel)) return;
  if (!!layoutState.collapsed[panel] === collapsed) return;
  togglePanelCollapse(root, panel);
}

/**
 * Aplica as larguras e classes de colapso a todos os painéis.
 * @param {HTMLElement} root
 */
export function applyAllWidths(root) {
  for (const [panel, width] of Object.entries(layoutState.widths)) {
    const el = root.querySelector(`.proto-col-${panel}`);
    if (!el) continue;

    const isCollapsed = !!layoutState.collapsed[panel];
    el.classList.toggle("collapsed", isCollapsed);

    if (isCollapsed) {
      /** @type {HTMLElement} */ (el).style.width = "36px";
      /** @type {HTMLElement} */ (el).style.flex = "0 0 36px";
    } else {
      /** @type {HTMLElement} */ (el).style.width = `${width}px`;
      /** @type {HTMLElement} */ (el).style.flex = `0 0 ${width}px`;
    }
  }
}

/**
 * Configura o comportamento de redimensionamento do splitter.
 * @param {HTMLElement} root
 * @param {HTMLElement} resizer
 * @param {string} targetKey
 * @param {string} direction
 */
function setupResizer(root, resizer, targetKey, direction) {
  let startX = 0;
  let startW = 0;
  let isDragging = false;

  function onMouseDown(e) {
    if (layoutState.collapsed[targetKey]) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    const targetEl = /** @type {HTMLElement} */ (root.querySelector(`.proto-col-${targetKey}`));
    if (!targetEl) return;
    startW = targetEl.offsetWidth;

    resizer.classList.add("dragging");
    document.body.classList.add("proto-resizing");

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const delta = direction === "right" ? -dx : dx;
    let newW = startW + delta;

    const limits = LIMITS[targetKey] || { min: 180, max: 500 };
    if (newW < limits.min) newW = limits.min;
    if (newW > limits.max) newW = limits.max;

    layoutState.widths[targetKey] = Math.round(newW);
    const targetEl = /** @type {HTMLElement} */ (root.querySelector(`.proto-col-${targetKey}`));
    if (targetEl) {
      targetEl.style.width = `${newW}px`;
      targetEl.style.flex = `0 0 ${newW}px`;
    }
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove("dragging");
    document.body.classList.remove("proto-resizing");
    saveLayoutState();

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  resizer.addEventListener("mousedown", onMouseDown);
}

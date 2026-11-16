// @ts-check
// Size of the Documentation panel: a handle on its left edge (drag, or arrow keys; double click restores the
// default) and a full screen toggle. Width and mode are remembered in localStorage (also under file://).
const KEY_WIDTH = "harness.docsPanel.width";
const KEY_FULL = "harness.docsPanel.full";
export const MIN_WIDTH = 360;
const STEP = 40;

/** @param {string} key */
function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @param {string} key @param {string | null} value */
function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage disabled: the size just is not remembered
  }
}

/**
 * Width kept inside the screen: at least MIN_WIDTH, at most the window minus a strip of the map.
 * @param {number} px @param {number} viewport
 */
export function clampWidth(px, viewport) {
  const max = Math.max(MIN_WIDTH, viewport - 48);
  return Math.round(Math.min(max, Math.max(MIN_WIDTH, px)));
}

/** @param {HTMLElement} root @param {number | null} px null = default width from the CSS */
function applyWidth(root, px) {
  if (px === null) root.style.removeProperty("--docs-panel-w");
  else root.style.setProperty("--docs-panel-w", `${clampWidth(px, window.innerWidth)}px`);
}

/** @param {HTMLElement} root @param {boolean} on */
export function setFullscreen(root, on) {
  root.classList.toggle("full", on);
  const btn = root.querySelector('[data-docs-action="full"]');
  if (btn) {
    btn.innerHTML = `<i class="fa-solid ${on ? "fa-compress" : "fa-expand"}"></i>`;
    btn.setAttribute("title", on ? "Sair da tela cheia" : "Tela cheia");
    btn.setAttribute("aria-pressed", String(on));
  }
  save(KEY_FULL, on ? "1" : null);
}

/** @param {HTMLElement} root */
export function toggleFullscreen(root) {
  setFullscreen(root, !root.classList.contains("full"));
}

/**
 * Adds the resize handle and restores the remembered size.
 * @param {HTMLElement} root the .docs-panel element
 */
export function initPanelSize(root) {
  const handle = document.createElement("div");
  handle.className = "docs-resize";
  handle.tabIndex = 0;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Redimensionar o painel (setas; duplo clique volta ao padrão)");
  root.prepend(handle);

  const saved = Number(load(KEY_WIDTH));
  applyWidth(root, saved > 0 ? saved : null);
  setFullscreen(root, load(KEY_FULL) === "1");

  const current = () => root.getBoundingClientRect().width;
  const commit = (px) => {
    applyWidth(root, px);
    save(KEY_WIDTH, String(clampWidth(px, window.innerWidth)));
  };

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    root.classList.add("resizing");
    const move = (ev) => applyWidth(root, window.innerWidth - ev.clientX);
    const up = (ev) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      root.classList.remove("resizing");
      commit(window.innerWidth - ev.clientX);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
  handle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") commit(current() + STEP);
    else if (e.key === "ArrowRight") commit(current() - STEP);
    else return;
    e.preventDefault();
  });
  handle.addEventListener("dblclick", () => {
    applyWidth(root, null);
    save(KEY_WIDTH, null);
  });
}

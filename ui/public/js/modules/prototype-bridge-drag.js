// @ts-check
(() => {
  // Arrastar elementos dentro do canvas para reordenar no fluxo do HTML (roda no iframe).
  // Mostra a linha de encaixe e, ao soltar, avisa a janela-mãe: HARNESS_PROTO_REORDER.
  if (typeof window === "undefined" || window === window.top) return;
  // @ts-ignore
  const bridge = window.__harnessBridge;
  if (!bridge) return;

  const THRESHOLD = 5;
  const VOID_TAGS = new Set(["img", "input", "br", "hr"]);
  /** @type {{ el: Element, x: number, y: number, active: boolean, drop: null | { target: Element, position: string } } | null} */
  let drag = null;
  let suppressClick = false;
  let indicator = /** @type {HTMLElement | null} */ (null);

  document.head.insertAdjacentHTML("beforeend", '<style id="harnessDragStyle">.harness-dragging{opacity:.45!important}.harness-drop{position:fixed;z-index:2147483647;pointer-events:none;background:#2563eb;border-radius:2px;box-sizing:border-box}.harness-drop.is-inside{background:rgba(37,99,235,.1);border:2px solid #2563eb}</style>');

  const canDrag = (el) => !!el && el !== document.body && !!el.getAttribute("data-pid") && el.getAttribute("data-locked") !== "true";

  function isHorizontal(el) {
    const parent = el.parentElement;
    if (!parent) return false;
    const cs = getComputedStyle(parent);
    return /flex/.test(cs.display) && cs.flexDirection.startsWith("row");
  }

  /** Alvo sob o cursor: elemento com data-pid que não seja o arrastado nem filho dele. */
  function dropAt(x, y) {
    if (!drag) return null;
    for (const hit of document.elementsFromPoint(x, y)) {
      if (hit === indicator || hit === drag.el || drag.el.contains(hit)) continue;
      const target = hit.closest("[data-pid]");
      if (!target || target === drag.el || drag.el.contains(target) || target === document.body) continue;
      const r = target.getBoundingClientRect();
      const horizontal = isHorizontal(target);
      const frac = horizontal ? (x - r.left) / (r.width || 1) : (y - r.top) / (r.height || 1);
      const leaf = VOID_TAGS.has(target.tagName.toLowerCase()) || r.width < 24 || r.height < 24;
      const position = frac < (leaf ? 0.5 : 0.25) ? "before" : frac > (leaf ? 0.5 : 0.75) ? "after" : "inside";
      return { target, position, rect: r, horizontal };
    }
    return null;
  }

  function showIndicator(drop) {
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "harness-drop";
      document.body.appendChild(indicator);
    }
    if (!drop) { indicator.style.display = "none"; return; }
    const { rect, position, horizontal } = drop;
    const s = indicator.style;
    indicator.classList.toggle("is-inside", position === "inside");
    s.display = "block";
    if (position === "inside") { s.left = `${rect.left}px`; s.top = `${rect.top}px`; s.width = `${rect.width}px`; s.height = `${rect.height}px`; return; }
    if (horizontal) { s.left = `${(position === "before" ? rect.left : rect.right) - 1}px`; s.top = `${rect.top}px`; s.width = "3px"; s.height = `${rect.height}px`; return; }
    s.left = `${rect.left}px`; s.top = `${(position === "before" ? rect.top : rect.bottom) - 1}px`; s.width = `${rect.width}px`; s.height = "3px";
  }

  function finish(commit) {
    if (!drag) return;
    const { el, active, drop } = drag;
    el.classList.remove("harness-dragging");
    document.documentElement.style.cursor = "";
    document.documentElement.style.userSelect = "";
    indicator?.remove();
    indicator = null;
    drag = null;
    if (!active) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (commit && drop) bridge.send("HARNESS_PROTO_REORDER", { pid: el.getAttribute("data-pid"), targetPid: drop.target.getAttribute("data-pid"), position: drop.position });
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || bridge.mode() === "play") return;
    const el = /** @type {Element} */ (e.target).closest?.("[data-pid]");
    if (!canDrag(el)) return;
    drag = { el, x: e.clientX, y: e.clientY, active: false, drop: null };
  }, true);

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < THRESHOLD) return;
      drag.active = true;
      drag.el.classList.add("harness-dragging");
      document.documentElement.style.cursor = "grabbing";
      document.documentElement.style.userSelect = "none";
      bridge.select(drag.el);
    }
    e.preventDefault();
    const drop = dropAt(e.clientX, e.clientY);
    drag.drop = drop ? { target: drop.target, position: drop.position } : null;
    showIndicator(drop);
  }, true);

  document.addEventListener("pointerup", () => finish(true), true);
  document.addEventListener("pointercancel", () => finish(false), true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drag) finish(false); }, true);
  // Depois de arrastar, o clique que o navegador dispara não deve selecionar de novo.
  window.addEventListener("click", (e) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
})();

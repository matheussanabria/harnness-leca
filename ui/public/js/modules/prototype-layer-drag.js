// @ts-check
/** Arrastar camadas para reordenar: antes, depois ou dentro da camada de destino. */
export function bindLayerDrag(container, onMove) {
  let dragId = "";
  const clear = () => container.querySelectorAll(".drop-before, .drop-after, .drop-inside").forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-inside"));
  const positionOf = (row, event) => {
    const r = row.getBoundingClientRect();
    const frac = (event.clientY - r.top) / (r.height || 1);
    return frac < 0.25 ? "before" : frac > 0.75 ? "after" : "inside";
  };
  container.querySelectorAll(".layer-item-row").forEach((row) => {
    const el = /** @type {HTMLElement} */ (row);
    el.addEventListener("dragstart", (event) => {
      dragId = el.dataset.nodeId || "";
      event.dataTransfer?.setData("text/plain", dragId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      el.classList.add("is-dragging");
    });
    el.addEventListener("dragend", () => { dragId = ""; el.classList.remove("is-dragging"); clear(); });
    el.addEventListener("dragover", (event) => {
      if (!dragId || dragId === el.dataset.nodeId) return;
      event.preventDefault();
      clear();
      el.classList.add(`drop-${positionOf(el, event)}`);
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-before", "drop-after", "drop-inside"));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      const source = dragId;
      const target = el.dataset.nodeId || "";
      const position = positionOf(el, event);
      clear();
      if (source && target && source !== target) onMove?.(source, target, position);
    });
  });
}

// @ts-check
const TOOLS = [
  ["select", "fa-arrow-pointer", "Selecionar (V)"],
  ["hand", "fa-hand", "Mover canvas (H ou Espaço)"],
  ["frame", "fa-expand", "Quadro (F)"],
  ["text", "fa-font", "Texto (T)"],
  ["sticky", "fa-note-sticky", "Nota (S)"],
  ["rect", "fa-square", "Retângulo (R)"],
  ["code", "fa-code", "Bloco de código (C)"],
];

/** Barra de ferramentas flutuante do canvas. `actions` recebe os callbacks do modo. */
export function mountToolbar(engine, actions) {
  const slot = /** @type {HTMLElement} */ (engine.root.querySelector(".cv-toolbar-slot"));
  const tools = TOOLS.map(([id, icon, title]) => `<button type="button" class="cv-tool" data-tool="${id}" title="${title}"><i class="fa-solid ${icon}"></i></button>`).join("");
  slot.innerHTML = `
    <div class="cv-toolbar">
      ${tools}
      <span class="cv-sep"></span>
      <button type="button" class="cv-tool" data-act="zoom-out" title="Reduzir (-)"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
      <button type="button" class="cv-tool" data-act="zoom-in" title="Ampliar (+)"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
      <button type="button" class="cv-tool" data-act="fit" title="Ajustar tudo (Shift+1)"><i class="fa-solid fa-maximize"></i></button>
      <span class="cv-sep"></span>
      <button type="button" class="cv-tool" data-act="to-code" title="Selecionado vira bloco de código" disabled><i class="fa-solid fa-file-code"></i></button>
      <button type="button" class="cv-tool" data-act="duplicate" title="Duplicar (Ctrl+D)"><i class="fa-regular fa-clone"></i></button>
      <button type="button" class="cv-tool" data-act="delete" title="Excluir (Del)"><i class="fa-regular fa-trash-can"></i></button>
      <span class="cv-sep"></span>
      <button type="button" class="cv-tool cv-play-btn" data-act="play" title="Iniciar a navegação a partir da tela selecionada"><i class="fa-solid fa-play"></i> Iniciar</button>
    </div>`;
  const syncTool = () => slot.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", /** @type {HTMLElement} */ (b).dataset.tool === engine.tool));
  slot.addEventListener("click", (e) => {
    const button = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest("button"));
    if (!button || button.disabled) return;
    if (button.dataset.tool) return engine.setTool(button.dataset.tool);
    const act = button.dataset.act;
    if (act === "zoom-in") engine.zoomBy(1.25);
    else if (act === "zoom-out") engine.zoomBy(0.8);
    else if (act === "fit") engine.fit();
    else if (act === "duplicate") engine.duplicate();
    else if (act === "delete") engine.remove();
    else actions[act]?.();
  });
  engine.root.addEventListener("cv-tool", syncTool);
  syncTool();
  return {
    setToCodeEnabled(enabled) {
      const button = /** @type {HTMLButtonElement|null} */ (slot.querySelector('[data-act="to-code"]'));
      if (button) button.disabled = !enabled;
    },
    setHidden(hidden) { slot.hidden = hidden; },
  };
}

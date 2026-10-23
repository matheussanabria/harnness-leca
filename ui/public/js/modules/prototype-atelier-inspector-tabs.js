// @ts-check
// Abas Ambos / Camadas / Propriedades do inspetor do Ateliê.
import { $ } from "../shared/dom.js";

export function bindInspectorTabs() {
  document.querySelectorAll(".inspector-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".inspector-tab-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const tab = /** @type {HTMLElement} */ (button).dataset.tab;
      const layers = $("inspectorLayersSection");
      const properties = $("inspectorPropsSection");
      if (!layers || !properties) return;
      layers.style.display = tab === "props" ? "none" : "flex";
      properties.style.display = tab === "layers" ? "none" : "block";
      layers.style.flex = "1";
      properties.style.flex = "1";
    });
  });
}

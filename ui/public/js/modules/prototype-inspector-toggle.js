// @ts-check
import { $ } from "../shared/dom.js";

/**
 * Liga/desliga o inspetor do Ateliê. Desligado, a tela roda "de verdade" (sem contornos, sem seleção de
 * elementos e com os scripts ativos); ligado, o clique seleciona o elemento para edição.
 */
const KEY = "harness.atelier.inspector";

function readStored() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

let enabled = readStored();

export const isInspectorOn = () => enabled;

/** Modo da ponte para a tela única: "legacy" (seleciona e navega) ou "play" (executa). */
export const singleScreenMode = () => (enabled ? "legacy" : "play");

function reflect(button) {
  button.classList.toggle("active", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  button.title = enabled ? "Inspetor ligado: clique seleciona elementos. Clique para desligar." : "Inspetor desligado: a tela roda sem sobreposições. Clique para ligar.";
  const label = button.querySelector("span");
  if (label) label.textContent = enabled ? "Inspetor" : "Inspetor off";
}

/** @param {(on: boolean) => void} apply aplica o novo estado à tela única ou ao canvas */
export function bindInspectorToggle(apply) {
  const button = $("btnAtelierInspector");
  if (!button) return;
  reflect(button);
  button.addEventListener("click", () => {
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch {}
    reflect(button);
    apply(enabled);
  });
}

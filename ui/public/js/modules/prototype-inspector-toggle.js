// @ts-check
import { $ } from "../shared/dom.js";

/**
 * Liga/desliga o inspetor do Ateliê. Desligado, a tela roda "de verdade" (sem contornos, sem seleção de
 * elementos e com os scripts ativos); ligado, o clique seleciona o elemento para edição.
 */
let enabled = true;

export const isInspectorOn = () => enabled;

/**
 * Define o inspetor a partir do estado restaurado (sem clique do usuário).
 * @param {boolean} value
 */
export function setInspectorEnabled(value) {
  enabled = value !== false;
  return enabled;
}

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
    reflect(button);
    apply(enabled);
  });
}

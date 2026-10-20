// @ts-check
// Ponto de entrada da tela de deploy: registra os handlers globais (window.*) e inicia a tela.
import { init } from "./deploy-data.js";
import "./deploy-run.js";
import "./deploy-modals.js";
import "./deploy-utils.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

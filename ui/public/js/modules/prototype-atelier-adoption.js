// @ts-check
// Liga o estado persistido do Ateliê (EP-14.08) ao controlador do protótipo.
import { getRouter, routeTo } from "../shared/router.js";
import { applyWorkspaceLayout, onWorkspaceLayoutChange } from "./prototype-workspace-layout.js";
import { setInspectorEnabled } from "./prototype-inspector-toggle.js";
import { hydrateCanvasDocs } from "./prototype-canvas/canvas-store.js";
import {
  pickAtelierScreen,
  readAtelierState,
  restoreViewport,
  saveAtelierState,
  shouldRedirectToSavedPrototype,
} from "./prototype-atelier-state.js";

/** @type {Record<string, any> | null} */
let saved = null;
let bootChecked = false;
let unbindLayout = null;

/**
 * Lê o estado salvo antes de montar o Ateliê. Na primeira montagem da página,
 * reabre o protótipo salvo quando ele ainda está no catálogo.
 * @param {{ protoId?: string, catalog?: Array<{ id?: string, kind?: string }>, onSelect?: Function }} [options]
 */
export async function beginAtelierAdoption(options = {}) {
  saved = await readAtelierState({ client: options.client }).catch(() => null);
  hydrateCanvasDocs(saved?.canvas);
  if (!bootChecked) {
    bootChecked = true;
    const target = shouldRedirectToSavedPrototype(saved, options.protoId || "", options.catalog || []);
    if (target && typeof options.onSelect === "function") {
      options.onSelect(target, "atelier");
      return { redirect: target, saved };
    }
  }
  return { redirect: "", saved };
}

/** Tela a abrir conforme o estado salvo, validada contra as telas do protótipo. */
export function restoredAtelierScreen(screens = [], fallback = "home") {
  return pickAtelierScreen(saved?.activeScreen, screens, fallback);
}

/** Largura do preview salva ou o padrão do Ateliê. */
export function restoredAtelierViewport() {
  return restoreViewport(saved?.viewport);
}

/** Nó selecionado salvo, para reaplicar quando o iframe avisar que está pronto. */
export function restoredAtelierNode() {
  return typeof saved?.selectedNode === "string" ? saved.selectedNode : "";
}

/** Aplica larguras, painéis recolhidos e inspetor salvos ao root recém-renderizado. */
export function applyAtelierLayout(root) {
  if (!root) return;
  if (saved?.workspaceLayout) applyWorkspaceLayout(root, saved.workspaceLayout);
  if (typeof saved?.inspector === "boolean") setInspectorEnabled(saved.inspector);
}

/** Persiste toda mudança de largura ou recolhimento dos painéis. */
export function bindAtelierLayout() {
  if (unbindLayout) return;
  unbindLayout = onWorkspaceLayoutChange((layout) => {
    void saveAtelierState({ workspaceLayout: layout });
  });
}

/** @param {string} protoId @param {string} screen */
export function persistAtelierActive(protoId, screen) {
  // The prototype and its screen are part of the address (#/prototypes/<proto>/<screen>); no new history entry.
  if (protoId) routeTo("prototypes", [protoId, screen].filter(Boolean));
  return saveAtelierState({ activePrototype: protoId, activeScreen: screen });
}

/** Troca de tela limpa o nó selecionado, que pertence à tela anterior. */
export function persistAtelierScreen(screen) {
  const route = getRouter()?.current();
  if (route && route.screen === "prototypes" && route.params[0]) routeTo("prototypes", [route.params[0], screen].filter(Boolean));
  return saveAtelierState({ activeScreen: screen, selectedNode: "" });
}

/** @param {number} width */
export function persistAtelierViewport(width) {
  return saveAtelierState({ viewport: String(width) });
}

/** @param {string} pid */
export function persistAtelierNode(pid) {
  return saveAtelierState({ selectedNode: pid || "" });
}

/** @param {boolean} on */
export function persistAtelierInspector(on) {
  return saveAtelierState({ inspector: Boolean(on) });
}

/** Reseta a decisão de reabertura (troca de projeto ou testes). */
export function resetAtelierAdoption() {
  saved = null;
  bootChecked = false;
  setInspectorEnabled(true);
  unbindLayout?.();
  unbindLayout = null;
}

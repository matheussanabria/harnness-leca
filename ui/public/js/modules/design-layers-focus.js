// @ts-check
// Escolher um campo com protótipo aberto: refaz so a barra de camadas e a coluna direita e destaca o trecho no protótipo.
// O quadro (iframe) fica como esta, para nao recarregar nem fechar o acordeao que o usuario abriu.
import { renderLayersTabsNav } from "./design-layers/layers-tabs-nav.js";
import { renderLayersRightColumn } from "./design-layers/layers-right-content.js";
import { highlightFocusedField } from "./design-layers/layers-screen-replica-proto.js";

/**
 * @param {ParentNode | null} container area do workspace de camadas
 * @param {any} screen tela atual
 * @returns {boolean} false quando nao ha protótipo aberto (o chamador faz o redesenho completo)
 */
export function refreshFocusInPlace(container, screen) {
  const wrap = container?.querySelector?.(".replica-proto-wrap");
  const tabs = container?.querySelector?.(".layers-tabs-nav");
  const right = container?.querySelector?.(".layers-col-right");
  if (!wrap || !tabs || !right || !screen) return false;
  tabs.outerHTML = renderLayersTabsNav(screen);
  right.innerHTML = renderLayersRightColumn(screen);
  highlightFocusedField(container);
  return true;
}

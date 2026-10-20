// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { renderDetailUiLayer, renderDetailRulesLayer } from "./layers-detail-ui-rules.js";
import { renderDetailApiLayer, renderDetailDataLayer } from "./layers-detail-api-data.js";
import { renderDetailTestsLayer, renderDetailLegacyLayer } from "./layers-detail-tests-legacy.js";

/**
 * Renderiza o container da Coluna Direita (~54%).
 * @param {any} sc
 * @returns {string}
 */
export function renderLayersRightColumn(sc) {
  if (!sc) return '<div class="right-col-empty">Nenhuma tela selecionada.</div>';

  const focusedField = (sc.fields || []).find((f) => f.id === dls.focusedFieldId);

  // Bloco introdutório com status de rastreamento e ação de limpar
  const trackerBannerHtml = focusedField ? `
    <div class="field-tracker-card active">
      <div class="tracker-info">
        <span class="tracker-marker-num">${esc(focusedField.n || focusedField.id)}</span>
        <div class="tracker-text">
          <span class="tracker-label">Campo em foco rastreado:</span>
          <b class="tracker-title">${esc(focusedField.label || focusedField.id)}</b>
          ${focusedField.ui?.c ? `<code class="tracker-code">&lt;${esc(focusedField.ui.c)}&gt;</code>` : ""}
        </div>
      </div>
      <button type="button" class="btn-clear-tracker" onclick="setFocusedField(null)" title="Ver todos os itens desta camada">
        <i class="fa-solid fa-xmark"></i> <span>Limpar filtro</span>
      </button>
    </div>
  ` : `
    <div class="field-tracker-card idle">
      <div class="tracker-hint">
        <i class="fa-solid fa-crosshairs"></i>
        <span><b>Rastreabilidade Ativa:</b> Clique em um campo na tela à esquerda ou nos marcadores circulares amarelos para filtrar suas regras, APIs, dados, testes e legado.</span>
      </div>
    </div>
  `;

  // Conteúdo da camada ativa
  let layerContentHtml = "";
  const layer = dls.activeLayer || "ui";

  switch (layer) {
    case "ui":
      layerContentHtml = renderDetailUiLayer(sc);
      break;
    case "rules":
    case "business":
      layerContentHtml = renderDetailRulesLayer(sc);
      break;
    case "api":
      layerContentHtml = renderDetailApiLayer(sc);
      break;
    case "data":
      layerContentHtml = renderDetailDataLayer(sc);
      break;
    case "tests":
      layerContentHtml = renderDetailTestsLayer(sc);
      break;
    case "legacy":
      layerContentHtml = renderDetailLegacyLayer(sc);
      break;
    default:
      layerContentHtml = renderDetailUiLayer(sc);
      break;
  }

  return `
    <div class="layers-right-column">
      ${trackerBannerHtml}
      <div class="layers-active-detail-viewport">
        ${layerContentHtml}
      </div>
    </div>
  `;
}

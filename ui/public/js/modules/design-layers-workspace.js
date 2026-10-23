// @ts-check
// Workspace do Mapa em Camadas — Layout em Duas Colunas (46% / 54%)
import { $, esc } from "../shared/dom.js";
import { dls } from "./design-layers-store.js";
import { renderLayersModuleHeader } from "./design-layers/layers-header.js";
import { renderStagesNav } from "./design-layers/layers-stages-nav.js";
import { renderLayersTabsNav } from "./design-layers/layers-tabs-nav.js";
import { renderScreenReplica } from "./design-layers/layers-screen-replica.js";
import { renderLayersRightColumn } from "./design-layers/layers-right-content.js";
import { hydrateLayersState, persistLayersState, isLayersStateHydrated } from "./design-layers-state.js";

/**
 * Retorna a tela atualmente selecionada.
 * @returns {any}
 */
export function getCurrentScreen() {
  if (!dls.currentScreensData?.screens?.length) return null;
  return dls.currentScreensData.screens.find((s) => s.id === dls.activeScreenId) || dls.currentScreensData.screens[0];
}

/**
 * Renderiza o espaço de trabalho completo do Mapa em Camadas.
 * @param {HTMLElement} container
 * @param {string} projectSlug
 * @param {any} screensData
 */
export function renderLayersWorkspace(container, projectSlug, screensData) {
  dls.currentScreensData = screensData;

  const screens = screensData?.screens || [];
  if (screens.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mute)">Nenhuma tela cadastrada para este projeto.</div>';
    return;
  }

  if (!dls.activeScreenId || !screens.some((s) => s.id === dls.activeScreenId)) {
    dls.activeScreenId = screens[0].id;
  }
  if (!dls.activeViewport) {
    dls.activeViewport = "desktop";
  }

  const cur = getCurrentScreen();
  const vpMode = dls.activeViewport || "desktop";

  container.innerHTML = `
    <div class="layers-workspace-canvas vp-mode-${esc(vpMode)}">
      <!-- 1. Cabeçalho do Módulo DIS -->
      ${renderLayersModuleHeader(cur)}

      <!-- 2. Barra de Navegação por Etapas -->
      ${renderStagesNav(screens)}

      <!-- 3. Barra de Navegação pelas 6 Camadas -->
      ${renderLayersTabsNav(cur)}

      <!-- 4. Layout Principal: Duas Colunas (Esquerda 46% | Direita 54%) -->
      <div class="layers-two-columns-layout">
        <!-- Coluna Esquerda (~46%): Réplica Visual e Interativa da Tela -->
        <div class="layers-col-left">
          ${renderScreenReplica(cur)}
        </div>

        <!-- Coluna Direita (~54%): Conteúdo Contextual da Camada Ativa -->
        <div class="layers-col-right">
          ${renderLayersRightColumn(cur)}
        </div>
      </div>
    </div>
  `;

  if (!isLayersStateHydrated()) {
    hydrateLayersState().then((changed) => {
      if (changed) renderLayersWorkspace(container, projectSlug, screensData);
    });
  }
}

// Binds globais para os manipuladores onclick da interface
if (typeof window !== "undefined") {
  // @ts-ignore
  window.selectActiveScreen = (id) => {
    dls.activeScreenId = id;
    dls.focusedFieldId = null;
    void persistLayersState({ activeScreen: id, focusedField: "" });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
  };

  // @ts-ignore
  window.setLayerTab = (layer) => {
    dls.activeLayer = layer;
    void persistLayersState({ selectedLayer: layer });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
  };

  // @ts-ignore
  window.setFocusedField = (fid) => {
    // Alterna a seleção se clicar no mesmo campo
    if (dls.focusedFieldId === fid) {
      dls.focusedFieldId = null;
    } else {
      dls.focusedFieldId = fid;
    }
    void persistLayersState({ focusedField: dls.focusedFieldId || "" });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
  };

  // @ts-ignore
  window.openLayersTarget = (route, fieldId) => {
    const screens = dls.currentScreensData?.screens || [];
    const screen = screens.find((item) => item.route === route) || screens.find((item) => item.id === route);
    if (!screen) return false;
    dls.activeScreenId = screen.id;
    dls.focusedFieldId = fieldId && (screen.fields || []).some((field) => field.id === fieldId) ? fieldId : null;
    dls.activeLayer = "ui";
    void persistLayersState({ activeScreen: screen.id, focusedField: dls.focusedFieldId || "", selectedLayer: "ui" });
    const container = $("designViewContainer");
    if (container) renderLayersWorkspace(container, "", dls.currentScreensData);
    return true;
  };

  // @ts-ignore
  window.setLayersViewport = (vp) => {
    dls.activeViewport = vp;
    void persistLayersState({ viewport: vp });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
  };

  // @ts-ignore
  window.toggleFilterOnlyFocused = () => {
    dls.filterOnlyFocused = !dls.filterOnlyFocused;
    void persistLayersState({ filterOnlyFocused: dls.filterOnlyFocused });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
  };
}

// @ts-check
// Workspace do Mapa em Camadas — Layout em Duas Colunas (46% / 54%)
import { $, esc } from "../shared/dom.js";
import { dls } from "./design-layers-store.js";
import { renderLayersModuleHeader } from "./design-layers/layers-header.js";
import { renderStagesNav } from "./design-layers/layers-stages-nav.js";
import { renderAudienceSelector } from "./design-layers/layers-audience.js";
import { resolveActiveLayer } from "./design-layers/layers-audience-profiles.js";
import { renderLayersTabsNav } from "./design-layers/layers-tabs-nav.js";
import { renderScreenReplica } from "./design-layers/layers-screen-replica.js";
import { renderLayersRightColumn } from "./design-layers/layers-right-content.js";
import { mountPrototypeFrames } from "./design-layers/layers-screen-replica-proto.js";
import { refreshFocusInPlace } from "./design-layers-focus.js";
import { renderStoryFilesPanel } from "./design-layers/layers-story-files.js";
import { renderScreenDocsBar } from "./design-layers/layers-docs-refs.js";
import { renderScreenLinks } from "./design-layers/layers-screen-links.js";
import { openDocFromLocation } from "./design-layers/docs/docs-panel.js";
import { hydrateLayersState, persistLayersState, isLayersStateHydrated } from "./design-layers-state.js";

let docLocationChecked = false;

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

      ${renderAudienceSelector()}

      <!-- 3. Barra de Navegação pelas 6 Camadas -->
      ${renderLayersTabsNav(cur)}

      ${renderScreenDocsBar(cur)}
      ${renderScreenLinks(cur)}

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

      <!-- 5. Histórias e arquivos (histórico git) -->
      ${renderStoryFilesPanel(dls.storyFiles)}
    </div>
  `;
  mountPrototypeFrames(container);
  if (!docLocationChecked) {
    docLocationChecked = true;
    openDocFromLocation();
  }

  if (!isLayersStateHydrated()) {
    hydrateLayersState().then((changed) => {
      if (changed) renderLayersWorkspace(container, projectSlug, screensData);
    });
  }
}

/** Redraws the map in place when it is on screen (used after late data such as the docs index). */
export function refreshLayersWorkspace() {
  const container = typeof document !== "undefined" ? $("designViewContainer") : null;
  if (container && dls.currentScreensData && container.querySelector(".layers-workspace-canvas")) {
    renderLayersWorkspace(container, "", dls.currentScreensData);
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
    if (container && refreshFocusInPlace(container, getCurrentScreen())) return;
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
  window.setLayersAudience = (audience) => {
    dls.activeAudience = audience;
    dls.activeLayer = resolveActiveLayer(audience, dls.activeLayer);
    void persistLayersState({ audience, selectedLayer: dls.activeLayer });
    const container = $("designViewContainer");
    if (container && dls.currentScreensData) {
      renderLayersWorkspace(container, "", dls.currentScreensData);
    }
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

// @ts-check
// Modo inspetor: ouvinte de mensagens, ativação, painel rápido e busca por nome.
import { esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ist } from "./inspector-store.js";
import { getIframeDoc, normalizeComponentName } from "./inspector-dom.js";
import { inspectComponentByName } from "./inspector-bridge.js";
import { attachIframeListeners } from "./inspector-iframe.js";
import { closeInspectorPanel } from "./inspector-card.js";

/**
 * Registra o ouvinte de mensagens postMessage caso o app esteja em outra porta.
 */
export function ensureMessageListener() {
  if (ist.messageListenerRegistered) return;
  ist.messageListenerRegistered = true;

  window.addEventListener("message", (e) => {
    if (!e.data) return;
    if (e.data.type === "HARNESS_INSPECT_COMPONENT") {
      const rawComp = e.data.component || e.data.tag;
      const comp = normalizeComponentName(rawComp);
      if (comp) {
        showToast(`🔍 Componente recebido: ${comp}`);
        inspectComponentByName(comp, {
          domPath: e.data.target?.domPath || e.data.domPath || e.data.tag || "DOM",
          outerSnippet: e.data.snippet || `<${e.data.target?.tagName || e.data.tag || comp}>`,
          elementTag: e.data.target?.tagName || e.data.tag || comp,
          target: e.data.target,
          childComponent: e.data.childComponent,
          selector: e.data.selector,
        });
      }
    } else if (e.data.type === "HARNESS_INSPECTOR_CLOSED") {
      closeInspectorPanel();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const panel = $("inspectorResultCard");
      if ((panel && panel.style.display !== "none") || ist.isInspectorActive) {
        closeInspectorPanel();
      }
    }
  });
}

/**
 * Alterna a ativação do modo inspetor sem recarregar ou navegar o iframe.
 * @param {boolean} [force]
 */
export function toggleInspectorMode(force) {
  ist.isInspectorActive = force != null ? !!force : !ist.isInspectorActive;

  const btn = $("btnInspectorToggle");
  const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));

  if (!frame) {
    showToast("⚠️ Iframe do Studio não encontrado.");
    return;
  }

  ensureMessageListener();
  let banner = $("inspectorActiveBanner");

  if (ist.isInspectorActive) {
    if (btn) btn.classList.add("active");
    const doc = getIframeDoc();

    if (doc) {
      // Mesma origem: o overlay e os eventos são injetados diretamente no DOM do iframe
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "inspectorActiveBanner";
        banner.className = "inspector-active-banner";
        banner.innerHTML = `
          <span>🔍 <b>Modo Inspetor Ativo:</b> Passe o mouse sobre qualquer elemento e clique para inspecionar.</span>
          <div class="banner-actions">
            <span style="font-size:11px;opacity:0.85">Pressione ESC para cancelar</span>
            <button type="button" class="btn-banner-close" onclick="toggleInspectorMode(false)">✕ Fechar</button>
          </div>
        `;
        const wrapper = $("studioViewportContainer") || $("studioFrameWrapper");
        if (wrapper && wrapper.firstChild) {
          wrapper.insertBefore(banner, wrapper.firstChild);
        }
      } else {
        banner.style.display = "flex";
      }

      attachIframeListeners(doc);
      showToast("Modo Inspetor ativado! Clique em qualquer elemento no preview.");
    } else {
      // Outra porta / Cross-Origin: NÃO recarrega o iframe para não perder a navegação
      openQuickInspectorPanel();
    }
  } else {
    closeInspectorPanel();
  }
}

/**
 * Limpa qualquer elemento de hover que tenha sido injetado acidentalmente na janela principal
 */
export function cleanupParentHighlights() {
  // @ts-ignore
  window.__harnessActive = false;
  const strayBox = document.getElementById("__harness_hover_box__");
  if (strayBox) strayBox.remove();
  const strayBadge = document.getElementById("__harness_inspector_badge__");
  if (strayBadge) strayBadge.remove();
  const strayOverlay = document.getElementById("__harness_inspector_overlay__");
  if (strayOverlay) strayOverlay.remove();
}

/**
 * Abre o painel de inspeção rápida para selecionar o componente ou usar clique por script.
 */
export async function openQuickInspectorPanel() {
  cleanupParentHighlights();

  let panel = $("inspectorResultCard");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "inspectorResultCard";
    panel.className = "inspector-card";
    const container = $("studioViewportContainer") || $("studioFrameWrapper") || document.body;
    container.appendChild(panel);
  }

  const projectSlug = getEffectiveProjectSlug();

  panel.innerHTML = `
    <div class="inspector-card-header">
      <div class="inspector-card-title">
        <span>🔍 Inspetor de Componentes Angular</span>
        <span class="inspector-badge angular">Angular 18</span>
      </div>
      <button type="button" class="btn-vp" onclick="closeInspectorPanel()" style="font-size:11px;padding:3px 10px;background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.3);font-weight:bold;cursor:pointer" title="Desativar Inspetor">✕ Desativar (ESC)</button>
    </div>
    <div class="inspector-card-body">
      <div style="font-size:13px;color:var(--text);font-weight:600">
        Selecione o componente para ver arquivos (.ts, .html, .scss) e inserir no chat:
      </div>
      <div class="inspector-search-row">
        <input type="text" id="inspectorSearchInput" class="inspector-search-input" placeholder="Digite o seletor ou classe (ex: dados-paciente, entregas-liberadas, app-root)" onkeydown="if(event.key==='Enter') searchComponentFromInput()">
        <button type="button" class="inspector-btn-send" onclick="searchComponentFromInput()">🔍 Buscar</button>
      </div>

      <div style="font-size:11px;color:var(--mute);margin-top:4px">
        ⚡ <b>Componentes detectados neste app (clique para inspecionar):</b>
      </div>
      <div id="inspectorComponentChips" class="inspector-chips-box">
        <span style="font-size:11px;color:var(--mute)">Carregando componentes do repositório...</span>
      </div>

      <div class="inspector-tip-box" style="margin-top:6px">
        <div style="font-weight:600;margin-bottom:4px">💡 Quer clicar direto na tela do app?</div>
        <div style="font-size:11px;color:var(--mute);margin-bottom:8px">
          Para que o clique funcione <b>dentro do frame</b>, selecione <b>studioIframe</b> no DevTools (Console) antes de colar:
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button type="button" class="inspector-file-btn" onclick="copyClickBridgeScript()" style="font-size:11px;padding:4px 10px;background:var(--panel);color:var(--accent);border-color:var(--accent);font-weight:600">
            📋 Copiar Script para Console
          </button>
          <span style="font-size:11px;color:var(--mute)">Pressione <b>ESC</b> a qualquer momento para desativar</span>
        </div>
    </div>
  `;
  panel.style.display = "flex";

  // Carrega a lista de componentes do repositório para os chips de clique rápido
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/inspect/components`);
    const data = await res.json();
    const box = $("inspectorComponentChips");
    if (box && data.components && data.components.length) {
      box.innerHTML = data.components
        .map((c) => {
          const label = c.selector || c.className;
          return `<button type="button" class="inspector-chip-btn" onclick="inspectComponentByName('${esc(c.className)}')" title="${esc(c.relTs)}">&lt;${esc(label)}&gt;</button>`;
        })
        .join("");
    } else if (box) {
      box.innerHTML = '<span style="font-size:11px;color:var(--mute)">Nenhum componente @Component localizado.</span>';
    }
  } catch (err) {
    console.warn("[inspector/components]", err);
  }

  setTimeout(() => {
    const inp = $("inspectorSearchInput");
    if (inp) inp.focus();
  }, 100);
}

/**
 * Dispara busca a partir do input de texto do painel
 */
export function searchComponentFromInput() {
  const inp = /** @type {HTMLInputElement} */ ($("inspectorSearchInput"));
  if (!inp || !inp.value.trim()) {
    showToast("Digite o nome ou seletor do componente.");
    return;
  }
  inspectComponentByName(inp.value.trim());
}

/**
 * Retorna o slug do projeto ativo atualmente selecionado no Harness.
 * @returns {string}
 */
export function getEffectiveProjectSlug() {
  return state.P?.name || state.S?.active || "";
}

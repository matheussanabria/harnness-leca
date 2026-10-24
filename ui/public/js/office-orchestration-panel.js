// @ts-check
// DAI HQ — M2 Centro de Orquestração: Fachada Orquestradora do Painel 2D e Abas
import { renderOverviewTab, renderAgentDetails, renderExecutionDetails } from "./office3d/orchestration/tab-overview.js";
import { renderJournalTab, renderJournalSessionCards } from "./office3d/orchestration/tab-journal.js";
import { renderTimelineTab } from "./office3d/orchestration/tab-timeline.js";
import { renderControlTab, setupControlOperations } from "./office3d/orchestration/tab-control.js";
import { mountCentral } from "./modules/central-sessions.js";

let activeTab = "overview"; // "overview", "journal", "timeline", "control", "sessions"

/**
 * Renderiza o conteúdo do drawer para o Centro de Orquestração ou entidades do grafo
 * @param {Object} state - Estado global da aplicação
 * @param {string} objKey - Identificador do objeto selecionado
 * @returns {{ icon: string, title: string, subtitle: string, html: string }}
 */
export function getOrchestrationDrawerData(state, objKey) {
  const orchState = state.orchestrationState || {};
  const events = state.orchestrationEvents || [];
  const activeProj = state.activeProject || "projeto";

  if (objKey.startsWith("agent_")) {
    const agentId = objKey.replace("agent_", "");
    const agent = (orchState.agents || []).find(a => a.id === agentId) || {
      id: agentId,
      provider: agentId,
      status: "detected",
      confidence: "observed",
      lastSeen: new Date().toISOString()
    };

    return {
      icon: '<i class="fa-solid fa-robot" aria-hidden="true"></i>',
      title: `Agente: ${agent.name || agent.id}`,
      subtitle: `Motor: ${agent.provider.toUpperCase()} · Confiança: ${agent.confidence}`,
      html: renderAgentDetails(agent)
    };
  }

  if (objKey.startsWith("exec_")) {
    const execId = objKey.replace("exec_", "");
    const exec = (orchState.executions || []).find(e => e.id === execId) || {
      id: execId,
      provider: "desconhecido",
      status: "unknown",
      confidence: "unknown",
      startTime: new Date().toISOString()
    };

    return {
      icon: '<i class="fa-solid fa-bolt" aria-hidden="true"></i>',
      title: `Execução: ${exec.id.slice(0, 10)}...`,
      subtitle: `Provedor: ${exec.provider.toUpperCase()} · Status: ${exec.status.toUpperCase()}`,
      html: renderExecutionDetails(exec, events)
    };
  }

  return {
    icon: '<i class="fa-solid fa-landmark" aria-hidden="true"></i>',
    title: "Centro de Orquestração — DAI HQ (M2)",
    subtitle: `Telemetria em Tempo Real · Projeto "${activeProj}"`,
    html: renderMainOrchestrationPanel(orchState, events, activeProj, state)
  };
}

function renderMainOrchestrationPanel(orchState, events, activeProj, state) {
  const days = state?.journal?.days || (Array.isArray(state?.journal) ? state.journal : []);
  let journalCount = 0;
  for (const d of days) journalCount += (d.sessions || []).length;
  if (journalCount === 0 && state?.projectData?.chats) {
    journalCount = state.projectData.chats.length;
  }

  return `
    <div class="orch-tabs-nav" style="display:flex;gap:4px;margin-bottom:14px;background:rgba(15,23,42,0.8);padding:4px;border-radius:8px;border:1px solid rgba(56,189,248,0.2)">
      <button class="orch-tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview" style="flex:1;padding:7px 4px;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;background:${activeTab === 'overview' ? '#0284c7' : 'transparent'};color:${activeTab === 'overview' ? '#fff' : '#94a3b8'}">
        <i class="fa-solid fa-chart-line" aria-hidden="true"></i> Visão Geral
      </button>
      <button class="orch-tab-btn ${activeTab === 'journal' ? 'active' : ''}" data-tab="journal" style="flex:1;padding:7px 4px;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;background:${activeTab === 'journal' ? '#0284c7' : 'transparent'};color:${activeTab === 'journal' ? '#fff' : '#94a3b8'}">
        <i class="fa-solid fa-book" aria-hidden="true"></i> Conversas (${journalCount})
      </button>
      <button class="orch-tab-btn ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline" style="flex:1;padding:7px 4px;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;background:${activeTab === 'timeline' ? '#0284c7' : 'transparent'};color:${activeTab === 'timeline' ? '#fff' : '#94a3b8'}">
        <i class="fa-solid fa-bolt" aria-hidden="true"></i> SSE (${events.length})
      </button>
      <button class="orch-tab-btn ${activeTab === 'control' ? 'active' : ''}" data-tab="control" style="flex:1;padding:7px 4px;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;background:${activeTab === 'control' ? '#0284c7' : 'transparent'};color:${activeTab === 'control' ? '#fff' : '#94a3b8'}">
        <i class="fa-solid fa-gear" aria-hidden="true"></i> Operações
      </button>
      <button class="orch-tab-btn ${activeTab === 'sessions' ? 'active' : ''}" data-tab="sessions" style="flex:1;padding:7px 4px;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;background:${activeTab === 'sessions' ? '#0284c7' : 'transparent'};color:${activeTab === 'sessions' ? '#fff' : '#94a3b8'}" aria-pressed="${activeTab === 'sessions'}">
        <i class="fa-solid fa-diagram-project" aria-hidden="true"></i> Sessões
      </button>
    </div>

    <div id="orchTabContent">
      ${activeTab === "overview" ? renderOverviewTab(orchState, activeProj) : ""}
      ${activeTab === "journal" ? renderJournalTab(state, activeProj) : ""}
      ${activeTab === "timeline" ? renderTimelineTab(events) : ""}
      ${activeTab === "control" ? renderControlTab(orchState, activeProj) : ""}
      ${activeTab === "sessions" ? `<div id="centralSessionsRoot" data-slug="${activeProj.replace(/"/g, "")}"></div>` : ""}
    </div>
  `;
}

/**
 * Registra os event listeners das abas e das ações operacionais
 * @param {Object} state - Estado global da aplicação
 * @param {Function} reRenderFn - Função para re-renderizar o drawer
 */
export function setupOrchestrationPanelListeners(state, reRenderFn) {
  document.querySelectorAll(".orch-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      // @ts-ignore
      const tab = e.currentTarget?.getAttribute("data-tab");
      if (tab) {
        activeTab = tab;
        reRenderFn();
      }
    });
  });

  const agentFilter = /** @type {HTMLSelectElement} */ (document.getElementById("journalAgentFilter"));
  const searchInput = /** @type {HTMLInputElement} */ (document.getElementById("journalSearchInput"));
  const sessionListEl = document.getElementById("journalSessionList");

  const filterSessions = () => {
    if (!sessionListEl) return;
    const days = state?.journal?.days || (Array.isArray(state?.journal) ? state.journal : []);
    const projChats = state?.projectData?.chats || [];
    sessionListEl.innerHTML = renderJournalSessionCards(
      days,
      projChats,
      agentFilter ? agentFilter.value : "",
      searchInput ? searchInput.value : ""
    );
  };

  agentFilter?.addEventListener("change", filterSessions);
  searchInput?.addEventListener("input", filterSessions);

  // Central de Sessões (EP-09.03): monta apenas quando a aba está ativa.
  const centralRoot = document.getElementById("centralSessionsRoot");
  if (centralRoot) {
    const slug = centralRoot.getAttribute("data-slug") || "";
    mountCentral(centralRoot, { slug }).catch(() => {
      centralRoot.innerHTML = `<p class="central-empty"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar a Central de Sessões.</p>`;
    });
  }

  setupControlOperations(state);
}

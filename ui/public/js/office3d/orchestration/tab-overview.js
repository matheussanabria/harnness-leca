// @ts-check
// DAI HQ — M2 Orquestração: Aba de Visão Geral & Dossiês de Entidades
import { officeAgentState } from "../../office/office-agent-state.js";
import { summarizeEngine } from "../../office/office-engine-summary.js";

/**
 * Aba 1: Visão Geral de Orquestração
 * @param {any} orchState
 * @param {string} activeProj
 */
export function renderOverviewTab(orchState, activeProj) {
  const integrations = orchState.integrations || {};
  const executions = orchState.executions || [];

  const providers = [
    { key: "claude", name: "Claude Code", icon: "fa-solid fa-robot", color: "#d97757", info: integrations.claude },
    { key: "gemini", name: "Gemini Antigravity", icon: "fa-solid fa-star", color: "#5c87f2", info: integrations.gemini },
    { key: "opencode", name: "OpenCode Lab", icon: "fa-solid fa-diamond", color: "#3cb371", info: integrations.opencode },
    { key: "services", name: "Processos Locais", icon: "fa-solid fa-gear", color: "#eab308", info: integrations.services }
  ];

  const intCardsHtml = providers.map(p => {
    // Mesmo resumo do telão e do dossiê: execução em andamento ou sessão aberta nunca aparece como STANDBY.
    const sum = summarizeEngine(p.key, { agentState: officeAgentState.getAgentState(p.key), executions, integration: p.info });
    const isConn = p.info?.status === "connected" || sum.state !== "integration";
    const statusText = sum.state === "working" ? "ATIVO" : isConn ? "CONECTADO" : (p.info?.status || "STANDBY").toUpperCase();
    const statusColor = isConn ? "#22c55e" : (p.info?.status === "error" ? "#ef4444" : "#94a3b8");
    const count = sum.activeCount;
    const openNote = sum.openCount > 0 ? ` · ${sum.openCount} ${sum.openCount === 1 ? "aberta" : "abertas"}` : "";
    const latency = p.info?.latencyMs ? `${p.info.latencyMs}ms` : "-";

    return `
      <div style="background:rgba(30,41,59,0.7);border:1px solid ${isConn ? 'rgba(56,189,248,0.3)' : 'rgba(148,163,184,0.2)'};border-radius:8px;padding:10px 12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;color:${p.color};font-size:13px"><i class="${p.icon}" aria-hidden="true"></i> ${p.name}</span>
          <span style="font-size:10px;font-weight:800;color:${statusColor};background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px">● ${statusText}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:#94a3b8">
          <span>Execuções: <b style="color:#f8fafc">${count}</b>${openNote}</span>
          <span>Latência: <b style="color:#f8fafc">${latency}</b></span>
        </div>
      </div>
    `;
  }).join("");

  let execListHtml = "";
  if (executions.length === 0) {
    execListHtml = `
      <div style="padding:14px;background:rgba(15,23,42,0.5);border-radius:8px;text-align:center;color:#94a3b8;font-size:12.5px;font-style:italic">
        Nenhuma execução ativa registrada no momento. O Event Engine está em escuta contínua.
      </div>
    `;
  } else {
    execListHtml = executions.slice(0, 8).map(ex => {
      let badgeBg = "rgba(56,189,248,0.15)";
      let badgeCol = "#38bdf8";
      if (ex.status === "failed") { badgeBg = "rgba(239,68,68,0.15)"; badgeCol = "#ef4444"; }
      else if (ex.status === "completed") { badgeBg = "rgba(34,197,94,0.15)"; badgeCol = "#22c55e"; }

      const subCount = ex.subagents ? ex.subagents.length : 0;
      const tasksCount = ex.tasks ? ex.tasks.length : 0;

      return `
        <div class="chat-item-row" onclick="window.triggerObject('exec_${encodeURIComponent(ex.id)}')" style="cursor:pointer;margin-bottom:8px" title="Clique para inspecionar execução">
          <div class="chat-item-info">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:700;color:#f8fafc;font-size:13px">${ex.title || ex.id.slice(0, 10)}</span>
              <span style="font-size:10px;font-weight:700;color:${badgeCol};background:${badgeBg};padding:2px 6px;border-radius:4px">${(ex.status || 'running').toUpperCase()}</span>
            </div>
            <div style="font-size:11.5px;color:#94a3b8;margin-top:2px">
              Provedor: <b style="color:#e2e8f0">${ex.provider}</b> · Tarefas: ${tasksCount} · Subagentes: ${subCount} · Confiança: <i>${ex.confidence || 'observed'}</i>
            </div>
          </div>
          <span style="color:var(--office-accent);font-size:12px">Inspecionar ↗</span>
        </div>
      `;
    }).join("");
  }

  return `
    <div class="drawer-card" style="border-color:rgba(56,189,248,0.3)">
      <div class="drawer-card-title" style="color:#38bdf8;margin-bottom:10px"><i class="fa-solid fa-satellite-dish" aria-hidden="true"></i> Estado das Integrações</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        ${intCardsHtml}
      </div>
      <div style="font-size:11.5px;color:#94a3b8;display:flex;justify-content:space-between">
        <span>Última Sincronização: <b style="color:#f8fafc">${orchState.lastSync ? new Date(orchState.lastSync).toLocaleTimeString() : 'Agora'}</b></span>
        <span>Streaming SSE: <b style="color:#22c55e">● ATIVO</b></span>
      </div>
    </div>

    <div class="drawer-card">
      <div class="drawer-card-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span><i class="fa-solid fa-bolt" aria-hidden="true"></i> Execuções Comprovadas (${executions.length})</span>
        <span style="font-size:11px;color:#94a3b8">Sem dados fictícios</span>
      </div>
      ${execListHtml}
    </div>
  `;
}

/**
 * Detalhes de um Agente Específico selecionado no Grafo 3D
 */
export function renderAgentDetails(agent) {
  return `
    <div class="drawer-card">
      <div class="drawer-card-title">Dossiê do Agente</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Identificador:</span><code style="color:#38bdf8">${agent.id}</code></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Provedor:</span><span style="font-weight:700;color:#f8fafc">${agent.provider}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Status Normalizado:</span><span style="font-weight:700;color:#22c55e">${(agent.status || 'detected').toUpperCase()}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Confiança dos Dados:</span><span style="color:#a855f7;font-weight:700">${agent.confidence || 'observed'}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Última Observação:</span><span style="color:#cbd5e1">${agent.lastSeen ? new Date(agent.lastSeen).toLocaleTimeString() : 'Recentemente'}</span></div>
      </div>
    </div>

    <div class="drawer-card">
      <div class="drawer-card-title">Capacidades & Limitações da Telemetria</div>
      <p style="font-size:12px;color:#94a3b8;margin:0 0 10px">
        Este agente é monitorado através do adaptador <b>${agent.provider}</b>, que coleta sessões, comandos e ferramentas utilizadas sem intermediários opacos.
      </p>
      <button onclick="window.triggerObject('war_room_main_panel')" class="header-nav-btn" style="width:100%;justify-content:center">
        ← Voltar ao Centro de Orquestração
      </button>
    </div>
  `;
}

/**
 * Detalhes de uma Execução Específica selecionada no Grafo 3D
 */
export function renderExecutionDetails(exec, events) {
  const relatedEvents = events.filter(e => e.executionId === exec.id || e.payload?.executionId === exec.id);

  return `
    <div class="drawer-card">
      <div class="drawer-card-title">Detalhes da Execução</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">ID da Execução:</span><code style="color:#38bdf8">${exec.id}</code></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Provedor:</span><span style="font-weight:700;color:#f8fafc">${exec.provider}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Status:</span><span style="font-weight:700;color:#22c55e">${(exec.status || 'running').toUpperCase()}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Confiança:</span><span style="color:#a855f7;font-weight:700">${exec.confidence || 'observed'}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:#94a3b8">Início:</span><span style="color:#cbd5e1">${exec.startTime ? new Date(exec.startTime).toLocaleTimeString() : '-'}</span></div>
      </div>
    </div>

    <div class="drawer-card">
      <div class="drawer-card-title">Eventos Vinculados (${relatedEvents.length})</div>
      ${relatedEvents.length === 0 ? `
        <div style="font-size:12px;color:#94a3b8;font-style:italic">Nenhum evento adicional registrado no buffer atual.</div>
      ` : relatedEvents.map(e => `
        <div style="font-size:11.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between">
          <span style="color:#38bdf8">${e.type}</span>
          <span style="color:#64748b">${new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      `).join("")}

      <button onclick="window.triggerObject('war_room_main_panel')" class="header-nav-btn" style="width:100%;justify-content:center;margin-top:14px">
        ← Voltar ao Centro de Orquestração
      </button>
    </div>
  `;
}

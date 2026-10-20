// @ts-check
// Dossiê do agente na estação (renderização).
import { renderAgentSessionList } from "./office-desk-interaction.js";

/**
 * Renderiza o dossiê e chat interativo de um Agente
 * @param {string} agentKey
 * @param {any} state
 * @param {{ iconEl: HTMLElement, titleEl: HTMLElement, subtitleEl: HTMLElement, bodyEl: HTMLElement }} elements
 */
export function renderAgentInteractiveDesk(agentKey, state, { iconEl, titleEl, subtitleEl, bodyEl }) {
  const activeAg = state.activeAgents?.agents || {};
  const activeProj = state.activeProject || "projeto";

  const meta = {
    gemini: {
      name: "Gemini (Antigravity)",
      icon: "✦",
      color: "#5c87f2",
      role: "Motor Multimodal & Modelagem 3D",
      info: activeAg.gemini || { activeCount: 2, currentTask: "2 chats ativos · Construindo Escritório 3D" },
      welcome: `✦ Olá! Sou o Gemini conectado via Antigravity IDE. Estou pronto para responder perguntas, gerar código ou debugar funcionalidades no projeto "${activeProj}".`
    },
    claude: {
      name: "Claude Code",
      icon: "🤖",
      color: "#d97757",
      role: "Especialista em Engenharia & Refatoração",
      info: activeAg.claude || { activeCount: 1, currentTask: "1 chat ativo · Orquestrando no terminal (claude --resume)" },
      welcome: `🤖 Olá! Sou o Claude Code. Posso executar instruções de código, testes e refatorações no projeto "${activeProj}".`
    },
    opencode: {
      name: "OpenCode Lab",
      icon: "◆",
      color: "#3cb371",
      role: "Motor Local Autônomo & Gratuito",
      info: activeAg.opencode || { activeCount: 0, currentTask: "Em espera (Standby)" },
      welcome: `◆ Olá! Sou o OpenCode rodando em localhost sem custos de API. Pronto para tarefas locais no projeto "${activeProj}".`
    },
    codex: {
      name: "Codex",
      icon: "</>",
      color: "#22c55e",
      role: "Agente de Engenharia & Terminal",
      info: activeAg.codex || { activeCount: 0, currentTask: "Aguardando uma conversa" },
      welcome: `Codex pronto para atuar no projeto "${activeProj}".`
    }
  }[agentKey] || {
    name: agentKey,
    icon: "🤖",
    color: "#38bdf8",
    role: "Agente Autônomo DAI",
    info: { activeCount: 1, currentTask: "Ativo" },
    welcome: "Pronto para atuar no projeto."
  };

  iconEl.textContent = meta.icon;
  titleEl.textContent = `Estação ${meta.name}`;
  subtitleEl.textContent = `${meta.role} · Projeto "${activeProj}"`;

  const days = state.journal?.days || (Array.isArray(state.journal) ? state.journal : []);
  const allChats = state.projectData?.chats || [];

  const agentSessions = [];
  for (const d of days) {
    for (const s of (d.sessions || [])) {
      if ((s.agente || "").toLowerCase() === agentKey) {
        agentSessions.push({ ...s, day: d.day });
      }
    }
  }

  const agentChats = allChats.filter(c => (c.engine || "").toLowerCase().includes(agentKey));

  bodyEl.innerHTML = `
    <!-- Card 1: Status Operacional -->
    <div class="drawer-card">
      <div class="drawer-card-title">Telemetria & Atividade em Tempo Real</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span class="pill-dot online" style="width:12px;height:12px"></span>
        <span style="font-weight:700;color:${meta.color};font-size:14px">${meta.info.activeCount || 1} chat(s) em andamento</span>
      </div>
      <p style="background:${meta.color}18;border:1px solid ${meta.color}44;padding:10px 14px;border-radius:8px;color:#f8fafc;font-size:12.5px;margin:0 0 10px">
        ⚡ <b>Tarefa em execução:</b> ${meta.info.currentTask || 'Operando no projeto ' + activeProj}
      </p>
    </div>

    <!-- Card 2: Central de chat nativa, reutilizada sem duplicar streaming/renderização -->
    <div class="drawer-card" style="border:1px solid ${meta.color}55;background:rgba(15,23,42,0.9)">
      <div class="drawer-card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Central de Chat · ${meta.name}</span>
        <a href="/?p=${encodeURIComponent(activeProj)}&engine=${agentKey}&new=1" style="font-size:11px;color:${meta.color}">Novo chat</a>
      </div>
      <p style="margin:0;color:#cbd5e1;font-size:12.5px;line-height:1.5">
        Selecione uma conversa preservada abaixo para continuar no mesmo chat, com todo o historico carregado.
      </p>
    </div>

    <!-- Card 3: Ações Rápidas de Navegação -->
    <div class="drawer-card">
      <div class="drawer-card-title">Ações Rápidas de Chat</div>
      <div style="display:flex;gap:8px;flex-direction:column">
        <a href="/?engine=${agentKey}&new=1" class="header-nav-btn" style="justify-content:center;text-decoration:none">
          💬 Abrir Chat Completo na Central
        </a>
        <button id="btnLoadIn3DMonitor" class="header-nav-btn" style="justify-content:center;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38bdf8">
          🖥️ Carregar no Monitor 3D da Estação
        </button>
      </div>
    </div>

    <!-- Card 4: Histórico Preservado do Agente -->
    <div class="drawer-card">
      <div class="drawer-card-title">Conversas Preservadas de ${meta.name} (${agentSessions.length || agentChats.length})</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${renderAgentSessionList(agentSessions, agentChats, meta.color, activeProj)}
      </div>
    </div>
  `;

}

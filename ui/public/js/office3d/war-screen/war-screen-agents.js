// @ts-check
// DAI HQ — War Room Tactical Screen: Coluna 3 (Telemetria dos Agentes e Motores)

import { officeAgentState } from "../../office/office-agent-state.js";
import { summarizeEngine } from "../../office/office-engine-summary.js";

/**
 * @typedef {import('../../types/office.js').Agent} Agent
 * @typedef {import('../../types/office.js').OrchestrationState} OrchestrationState
 */

/**
 * Renderiza a Coluna 3 do Telão da Sala de Guerra
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Agent[] | Record<string, Agent>} agentsData
 * @param {OrchestrationState} orchestrationState
 */
export function renderColumnAgents(ctx, x, y, w, h, agentsData, orchestrationState) {
  // Card Container
  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(34, 197, 94, 0.2)";
  ctx.strokeRect(x, y, w, h);

  // Título da Coluna
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("TELEMETRIA DE AGENTES & MOTORES", x + 24, y + 42);

  ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 58);
  ctx.lineTo(x + w - 24, y + 58);
  ctx.stroke();

  const integrations = orchestrationState?.integrations || {};

  const allExecs = orchestrationState?.executions || [];
  // Mesmo resumo da Central e do dossiê; sem dado, 0 e "Standby" (nada de contagem inventada).
  const sumOf = (id) => summarizeEngine(id, { agentState: officeAgentState.getAgentState(id), executions: allExecs, integration: integrations[id] });
  const statusOf = (id, idle) => {
    const sum = sumOf(id);
    if (sum.state === "working") return "Ativo";
    if (sum.state === "open") return "Conectado";
    return integrations[id]?.status === "connected" ? "Ativo" : (integrations[id]?.status || idle);
  };
  const chatsOf = (id) => {
    const sum = sumOf(id);
    const open = sum.openCount > 0 ? ` · ${sum.openCount} ${sum.openCount === 1 ? "sessão aberta" : "sessões abertas"}` : "";
    return `${sum.activeCount > 0 ? `${sum.activeCount} em andamento` : "Em espera"}${open}`;
  };

  const agents = [
    {
      id: "claude",
      name: "Claude Code",
      icon: "[C]",
      color: "#d97757",
      role: "Orquestrador & Engenharia",
      status: statusOf("claude", "Standby"),
      chats: chatsOf("claude"),
      detail: "CLI Terminal · Sessões em ~/.claude/projects"
    },
    {
      id: "gemini",
      name: "Gemini (Antigravity)",
      color: "#5c87f2",
      role: "Fullstack & Modelagem 3D",
      status: statusOf("gemini", "Standby"),
      chats: chatsOf("gemini"),
      detail: "Antigravity IDE · Sessões em ~/.gemini/brain"
    },
    {
      id: "opencode",
      name: "OpenCode",
      icon: "◆",
      color: "#3cb371",
      role: "Offline QA & Hacker Lab",
      status: statusOf("opencode", "Standby"),
      chats: chatsOf("opencode"),
      detail: "Porta 63186 · SQLite opencode.db nativo"
    }
  ];

  let aY = y + 84;
  for (const ag of agents) {
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(x + 24, aY, w - 48, 220);
    ctx.strokeStyle = ag.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 24, aY, w - 48, 220);

    // Ícone e Nome
    const agentLabel = ag.icon ? `${ag.icon}  ${ag.name}` : ag.name;
    ctx.fillStyle = ag.color;
    ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(agentLabel, x + 40, aY + 44);

    // Badge de Status
    const isActive = ag.status === "Ativo" || ag.status === "Conectado" || ag.status === "connected";
    ctx.fillStyle = isActive ? "#22c55e" : "#64748b";
    ctx.beginPath();
    ctx.arc(x + w - 120, aY + 36, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isActive ? "#22c55e" : "#94a3b8";
    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(ag.status.toUpperCase(), x + w - 105, aY + 41);

    // Papel
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`Função: ${ag.role}`, x + 40, aY + 84);

    // Telemetria de Chats
    ctx.fillStyle = isActive ? "#38bdf8" : "#94a3b8";
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`Telemetria: ${ag.chats}`, x + 40, aY + 118);

    // Detalhes da Integração
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(ag.detail, x + 40, aY + 148);

    // Botão de Interação
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    ctx.fillRect(x + 40, aY + 170, 240, 32);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.strokeRect(x + 40, aY + 170, 240, 32);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`[E] Consultar Estação ${ag.name.split(" ")[0]}`, x + 50, aY + 192);

    aY += 244;
  }
}

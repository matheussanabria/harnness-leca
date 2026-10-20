// @ts-check
// DAI HQ — Renderizador das Estações de Agentes no Modo 2.5D (Avatares, Digitação e Balões de Status)
import { officeState } from "../office-state.js";
import { officeAgentState, STATUS_THEMES } from "../office/office-agent-state.js";

/**
 * Desenha uma mesa de trabalho de agente com avatar, tela de monitor e balão de status reativo
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} pos
 * @param {string} themeColor
 * @param {string} agentName
 * @param {string} engineKey
 * @param {number} time
 */
export function drawDesk(ctx, pos, themeColor, agentName, engineKey, time) {
  const runtimeState = officeAgentState ? officeAgentState.getAgentState(engineKey) : null;
  const agentData = (officeState?.activeAgents?.agents && officeState.activeAgents.agents[engineKey]) || { activeCount: 0, status: "idle" };
  const currentStatus = runtimeState?.status || agentData.status || "idle";
  const theme = STATUS_THEMES[currentStatus] || STATUS_THEMES.idle;
  const count = runtimeState?.activeCount ?? agentData.activeCount ?? 0;
  const isActive = currentStatus === "streaming" || currentStatus === "thinking" || count > 0;
  const isTyping = theme.isTyping || currentStatus === "streaming";

  // Sombra no chão
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, isActive ? 34 : 28, isActive ? 17 : 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = isActive
    ? (themeColor === "#d97757" ? "rgba(217, 119, 87, 0.22)" : "rgba(92, 135, 242, 0.22)")
    : "rgba(0,0,0,0.3)";
  ctx.fill();

  const deskH = 26;
  const topPoints = [
    { x: pos.x, y: pos.y - deskH - 12 },
    { x: pos.x + 24, y: pos.y - deskH },
    { x: pos.x, y: pos.y - deskH + 12 },
    { x: pos.x - 24, y: pos.y - deskH }
  ];

  // Pés da mesa
  ctx.strokeStyle = "#1b1a18";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y + 12); ctx.lineTo(topPoints[0].x, pos.y - 12);
  ctx.moveTo(topPoints[1].x, topPoints[1].y); ctx.lineTo(topPoints[1].x, pos.y);
  ctx.moveTo(topPoints[2].x, topPoints[2].y); ctx.lineTo(topPoints[2].x, pos.y + 12);
  ctx.moveTo(topPoints[3].x, topPoints[3].y); ctx.lineTo(topPoints[3].x, pos.y);
  ctx.stroke();

  // Tampo da mesa
  ctx.fillStyle = "#8a5a36";
  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  ctx.lineTo(topPoints[1].x, topPoints[1].y);
  ctx.lineTo(topPoints[2].x, topPoints[2].y);
  ctx.lineTo(topPoints[3].x, topPoints[3].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5a3a22";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Monitor
  const monX = pos.x - 4;
  const monY = pos.y - deskH - 8;
  ctx.fillStyle = "#222";
  ctx.fillRect(monX - 9, monY - 14, 18, 14);

  ctx.fillStyle = themeColor;
  ctx.fillRect(monX - 7, monY - 12, 14, 10);

  ctx.fillStyle = "#fff";
  const flicker = Math.sin(time * 8) > 0 ? 1 : 0;
  ctx.fillRect(monX - 5, monY - 9, 7, 1);
  ctx.fillRect(monX - 5, monY - 6, 9 + flicker, 1);

  // Avatar do agente sentado
  const avatarY = pos.y - deskH - 18 + Math.sin(time * 3) * 1.5;
  ctx.fillStyle = themeColor;
  ctx.beginPath();
  ctx.roundRect(pos.x - 7, avatarY - 14, 14, 12, 3);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.fillRect(pos.x - 4, avatarY - 10, 2.5, 2.5);
  ctx.fillRect(pos.x + 1.5, avatarY - 10, 2.5, 2.5);

  if (isTyping) {
    const typeHandL = Math.sin(time * 16) * 1.8;
    const typeHandR = Math.cos(time * 16) * 1.8;
    ctx.fillStyle = "#f8c291";
    ctx.fillRect(monX - 5 + typeHandL, pos.y - deskH - 2, 2.5, 2.5);
    ctx.fillRect(monX + 3 + typeHandR, pos.y - deskH - 2, 2.5, 2.5);
  }

  // Balão de Status estilo Habbo
  const bubbleY = avatarY - 34 + Math.sin(time * 2.5 + (engineKey === "gemini" ? 1.5 : 0)) * 2;
  const bubbleW = isActive ? 144 : 112;
  const bubbleH = 24;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = "rgba(10, 16, 28, 0.94)";
  ctx.beginPath();
  ctx.roundRect(pos.x - bubbleW / 2, bubbleY, bubbleW, bubbleH, 6);
  ctx.fill();

  ctx.strokeStyle = isActive ? theme.color : "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Rabicho do balão apontando para o avatar
  ctx.beginPath();
  ctx.moveTo(pos.x - 4, bubbleY + bubbleH);
  ctx.lineTo(pos.x + 4, bubbleY + bubbleH);
  ctx.lineTo(pos.x, bubbleY + bubbleH + 4);
  ctx.closePath();
  ctx.fillStyle = "rgba(10, 16, 28, 0.94)";
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = "transparent";

  // LED de status pulsante com a cor do estado
  const dotPulse = isActive ? (Math.sin(time * 6) > 0 ? 3.2 : 2.5) : 2.5;
  ctx.beginPath();
  ctx.arc(pos.x - bubbleW / 2 + 10, bubbleY + bubbleH / 2, dotPulse, 0, Math.PI * 2);
  ctx.fillStyle = theme.color;
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9.5px -apple-system, sans-serif";
  ctx.textAlign = "left";
  const statusText = count > 0 ? `${theme.label} (${count})` : theme.label;
  ctx.fillText(`${agentName}: ${statusText}`, pos.x - bubbleW / 2 + 18, bubbleY + bubbleH / 2 + 3.5);

  ctx.restore();
}

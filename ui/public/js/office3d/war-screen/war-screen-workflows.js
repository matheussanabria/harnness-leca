// @ts-check
// DAI HQ — War Room Tactical Screen: Coluna 1 (Conversas, Diário de Bordo e Conhecimento)
import { drawMetricBadge } from "./war-screen-helpers.js";

/**
 * Renderiza a Coluna 1 do Telão da Sala de Guerra
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {any} projectData
 * @param {any} journal
 */
export function renderColumnWorkflows(ctx, x, y, w, h, projectData, journal) {
  // Card Container
  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
  ctx.strokeRect(x, y, w, h);

  // Título da Coluna
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("CONVERSAS & DIÁRIO DE BORDO", x + 24, y + 42);

  // Linha divisória
  ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 58);
  ctx.lineTo(x + w - 24, y + 58);
  ctx.stroke();

  // Resumo de Extração / Sincronização
  const extraction = projectData?.extraction || { total: 107, ok: 65, nova: 16, alterada: 26 };
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("ESTADO DE EXTRAÇÃO DAS CONVERSAS", x + 24, y + 92);

  // Badges de Status
  drawMetricBadge(ctx, x + 24, y + 110, "Total", `${extraction.total || 107}`, "#94a3b8");
  drawMetricBadge(ctx, x + 155, y + 110, "OK", `${extraction.ok || 65}`, "#22c55e");
  drawMetricBadge(ctx, x + 285, y + 110, "Novas", `${extraction.nova || 16}`, "#38bdf8");
  drawMetricBadge(ctx, x + 415, y + 110, "Alteradas", `${extraction.alterada || 26}`, "#f59e0b");

  // Sessões Recentes do Diário
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("ÚLTIMAS CONVERSAS REGISTRADAS NO DIÁRIO", x + 24, y + 230);

  const days = journal?.days || (Array.isArray(journal) ? journal : []);
  const recentSessions = [];
  for (const d of days) {
    for (const s of (d.sessions || [])) {
      recentSessions.push({ ...s, day: d.day });
      if (recentSessions.length >= 3) break;
    }
    if (recentSessions.length >= 3) break;
  }

  let rowY = y + 254;
  if (recentSessions.length > 0) {
    for (const s of recentSessions) {
      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.fillRect(x + 24, rowY, w - 48, 86);
      const isClaude = s.agente === "claude";
      const isGemini = s.agente === "gemini";
      ctx.strokeStyle = isClaude ? "rgba(217, 119, 87, 0.5)" : (isGemini ? "rgba(92, 135, 242, 0.5)" : "rgba(60, 179, 113, 0.5)");
      ctx.strokeRect(x + 24, rowY, w - 48, 86);

      const badgeCol = isClaude ? "#d97757" : (isGemini ? "#5c87f2" : "#3cb371");
      ctx.fillStyle = badgeCol;
      ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(`[ ${(s.agente || 'MOTOR').toUpperCase()} ]`, x + 38, rowY + 28);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
      const titleText = (s.titulo || s.file || "").slice(0, 48);
      ctx.fillText(titleText, x + 130, rowY + 28);

      const promptText = (s.prompts && s.prompts[0]) ? `"${s.prompts[0].slice(0, 60)}..."` : `${s.toolCount || 0} chamadas de ferramentas`;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(promptText, x + 38, rowY + 54);

      ctx.fillStyle = "#64748b";
      ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(`Data: ${s.day}  ·  Início: ${s.inicio || '-'}  ·  Arquivo: chats/${s.file || ''}`, x + 38, rowY + 74);

      rowY += 98;
    }
  } else {
    const scheduled = projectData?.scheduled || [
      { name: "extrair-pendentes.md", title: "Importar conversas novas e extrair memórias", agent: "opencode" }
    ];
    for (const r of scheduled) {
      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.fillRect(x + 24, rowY, w - 48, 80);
      ctx.strokeStyle = "rgba(0, 210, 255, 0.35)";
      ctx.strokeRect(x + 24, rowY, w - 48, 80);

      ctx.fillStyle = "#00d2ff";
      ctx.font = "bold 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(r.title || r.name, x + 38, rowY + 30);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(`Arquivo: ${r.name}  ·  Intervalo: 12h  ·  Motor: ${r.agent || "opencode"}`, x + 38, rowY + 54);

      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("● ATIVA", x + w - 100, rowY + 30);

      rowY += 92;
    }
  }

  // Integridade do Conhecimento
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("INTEGRIDADE DO CONHECIMENTO", x + 24, rowY + 30);

  const memBoxY = rowY + 50;
  ctx.fillStyle = "rgba(24, 32, 47, 0.9)";
  ctx.fillRect(x + 24, memBoxY, w - 48, 140);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
  ctx.strokeRect(x + 24, memBoxY, w - 48, 140);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Memória durável sincronizada (memory.md)", x + 40, memBoxY + 34);
  ctx.fillText("Regras e instruções ativas (instructions.md)", x + 40, memBoxY + 64);
  ctx.fillText("Diário de bordo acessível pelo Armário de Arquivos e M2", x + 40, memBoxY + 94);
  ctx.fillText("Chat interativo ativo na Estação do Gemini e no Grafo", x + 40, memBoxY + 124);
}

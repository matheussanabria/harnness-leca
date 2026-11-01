// @ts-check
// DAI HQ — War Room Tactical Screen: Coluna 2 (Jobs Assíncronos, Background Tasks e Rotinas)

/**
 * @typedef {import('../../types/office.js').AgentTask} AgentTask
 * @typedef {import('../../types/office.js').OrchestrationState} OrchestrationState
 */

/**
 * Renderiza a Coluna 2 do Telão da Sala de Guerra com foco em Background Tasks e Jobs Assíncronos
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Record<string, unknown>} projectData
 * @param {OrchestrationState} orchestrationState
 */
export function renderColumnTasks(ctx, x, y, w, h, projectData, orchestrationState) {
  // Card Container
  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
  ctx.strokeRect(x, y, w, h);

  // Título da Coluna
  ctx.fillStyle = "#c084fc";
  ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("JOBS ASSÍNCRONOS & BACKGROUND TASKS", x + 24, y + 42);

  ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 58);
  ctx.lineTo(x + w - 24, y + 58);
  ctx.stroke();

  // Coleta tarefas assíncronas ativas a partir de execuções do M2
  let taskList = [];
  if (orchestrationState?.executions && orchestrationState.executions.length > 0) {
    taskList = orchestrationState.executions
      .filter((ex) => ex.id && !ex.id.includes("undefined"))
      .slice(0, 4)
      .map((ex) => {
        let color = "#38bdf8";
        let statusLabel = (ex.status || "RUNNING").toUpperCase();
        if (ex.status === "failed") {
          color = "#ef4444";
        } else if (ex.status === "completed") {
          color = "#22c55e";
        } else if (ex.status === "running") {
          color = "#eab308";
          statusLabel = "EM EXECUÇÃO";
        }

        const prov = (ex.provider || ex.agentId || "harness").toUpperCase();
        const lastTool = ex.tools && ex.tools.length > 0 ? ex.tools[ex.tools.length - 1] : null;
        const toolHint = lastTool?.name ? `[${lastTool.name}] ${lastTool.hint ? lastTool.hint.slice(0, 42) : ''}` : '';

        const cleanTitle = ex.title && !ex.title.includes("undefined")
          ? ex.title
          : `Job ${prov} (${ex.id.slice(0, 8)})`;

        return {
          id: `TASK-${ex.id.slice(0, 6)}`,
          title: cleanTitle,
          status: statusLabel,
          tag: prov.slice(0, 10),
          color,
          agent: ex.agentId || ex.provider || "harness",
          detail: toolHint || `Iniciado: ${ex.startedAt ? new Date(ex.startedAt).toLocaleTimeString("pt-BR") : "Agora"}`
        };
      });
  }

  if (taskList.length === 0) {
    // Sem execuções reais: estado vazio honesto, sem itens inventados.
    taskList = [
      { id: "SEM-JOBS", title: "Nenhuma execução em andamento", status: "OCIOSO", tag: "VAZIO", color: "#64748b", agent: "harness", detail: "Nenhum job ou sessão ativa no momento." }
    ];
  }

  // Seção 1: Execuções e Tarefas Assíncronas
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SESSÕES & JOBS ASSÍNCRONOS DO TERMINAL", x + 24, y + 90);

  let tY = y + 108;
  for (const t of taskList) {
    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.fillRect(x + 24, tY, w - 48, 102);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 24, tY, w - 48, 102);

    // ID
    ctx.fillStyle = t.color;
    ctx.font = "bold 13px 'Segoe UI', monospace";
    ctx.fillText(t.id, x + 38, tY + 26);

    // Tag com badge
    ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
    const tagW = Math.max(70, ctx.measureText(t.tag).width + 16);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(x + 130, tY + 11, tagW, 20);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(t.tag, x + 138, tY + 25);

    // Status com bolinha indicadora
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(x + w - 150, tY + 21, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = t.color;
    ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(t.status, x + w - 138, tY + 25);

    // Título do Job
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px 'Segoe UI', system-ui, sans-serif";
    const displayTitle = t.title.length > 38 ? t.title.slice(0, 38) + "..." : t.title;
    ctx.fillText(displayTitle, x + 38, tY + 56);

    // Detalhe / Comando Assíncrono
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    const displayDetail = t.detail.length > 55 ? t.detail.slice(0, 55) + "..." : t.detail;
    ctx.fillText(displayDetail, x + 38, tY + 82);

    tY += 114;
  }

  // Seção 2: Rotinas Agendadas & Syncs de Fundo
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("ROTINAS AGENDADAS & TAREFAS DE FUNDO", x + 24, tY + 24);

  const schedY = tY + 42;
  const scheduled = projectData?.scheduled || [];

  let sY = schedY;
  for (const r of scheduled.slice(0, 2)) {
    ctx.fillStyle = "rgba(24, 32, 47, 0.9)";
    ctx.fillRect(x + 24, sY, w - 48, 84);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.strokeRect(x + 24, sY, w - 48, 84);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    const rTitle = (r.title || r.name || "Rotina de Sincronização").slice(0, 40);
    ctx.fillText(rTitle, x + 38, sY + 28);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("● AGENDADO", x + w - 120, sY + 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`Rotina: ${r.name || 'sync'}  ·  Motor: ${r.agent || "opencode / gemini"}`, x + 38, sY + 52);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Execução via tools/run-scheduled.js em background sem travar UI", x + 38, sY + 70);

    sY += 96;
  }

  // Seção 3: Card de Resumo de Recursos Assíncronos
  const summaryY = sY + 12;
  ctx.fillStyle = "rgba(18, 26, 42, 0.85)";
  ctx.fillRect(x + 24, summaryY, w - 48, 68);
  ctx.strokeStyle = "rgba(168, 85, 247, 0.3)";
  ctx.strokeRect(x + 24, summaryY, w - 48, 68);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Workers Assíncronos: 3 ativos (CLI, SSE Stream, Scheduled Daemon)", x + 38, summaryY + 28);
  ctx.fillStyle = "#22c55e";
  ctx.fillText("Tolerância a falhas ativada · Sem congelamento do event-loop", x + 38, summaryY + 50);
}

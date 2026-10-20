// @ts-check
// DAI HQ — War Room Tactical Screen: Fachada Orquestradora do Telão Tático da Sala de Guerra
import { drawCornerAccents } from "./office3d/war-screen/war-screen-helpers.js";
import { renderColumnWorkflows } from "./office3d/war-screen/war-screen-workflows.js";
import { renderColumnTasks } from "./office3d/war-screen/war-screen-tasks.js";
import { renderColumnAgents } from "./office3d/war-screen/war-screen-agents.js";

export class WarRoomScreenRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext("2d");
  }

  /**
   * Renderiza os dados reais do Harness no Canvas do Painel Tático
   * @param {Object} data
   * @param {string} data.activeProject
   * @param {Object} [data.projectData]
   * @param {Object} [data.agentsData]
   * @param {Object} [data.orchestrationState]
   * @param {Object} [data.journal]
   */
  render({ activeProject, projectData, agentsData, orchestrationState, journal }) {
    const ctx = this.ctx;
    if (!ctx) return this.canvas;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Fundo Tecnológico com Gradiente e Grid Cibernético
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, "#080c14");
    bgGrad.addColorStop(0.5, "#0b1220");
    bgGrad.addColorStop(1, "#070b12");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Moldura cibernética externa e cantos de alta precisão
    ctx.strokeStyle = "rgba(0, 210, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    drawCornerAccents(ctx, 20, 20, w - 40, h - 40, "#00d2ff");

    // 2. Cabeçalho do Painel Tático (Header)
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(24, 24, w - 48, 86);
    ctx.strokeStyle = "rgba(0, 210, 255, 0.25)";
    ctx.strokeRect(24, 24, w - 48, 86);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("DAI HQ — WAR ROOM TACTICAL COMMAND", 54, 78);

    const projName = (activeProject || "PROJETO").toUpperCase();
    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`PROJETO: [ ${projName} ]`, 820, 77);

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(1620, 70, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 18px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("ORCHESTRATION ENGINE ONLINE", 1640, 77);

    // 3. Grid de 3 Colunas Operacionais Modularizadas
    const colY = 130;
    const colH = 880;
    const colW = (w - 76) / 3;

    // COLUNA 1: Workflows, Extração & Diário
    renderColumnWorkflows(ctx, 28, colY, colW, colH, projectData, journal);

    // COLUNA 2: Jobs Assíncronos, Background Tasks & Rotinas
    renderColumnTasks(ctx, 28 + colW + 10, colY, colW, colH, projectData, orchestrationState);

    // COLUNA 3: Telemetria de Agentes & Motores Conectados
    renderColumnAgents(ctx, 28 + (colW + 10) * 2, colY, colW, colH, agentsData, orchestrationState);

    // 4. Rodapé Tático com Atalhos e Telemetria
    ctx.fillStyle = "rgba(10, 16, 26, 0.95)";
    ctx.fillRect(24, h - 54, w - 48, 30);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("CONTROLES: [W,A,S,D] Andar  |  [Mover Mouse] Câmera  |  [C] 1ª/3ª Pessoa  |  [Alt/M] Liberar Cursor  |  [Esc] Sair do Foco", 48, h - 34);

    const now = new Date().toLocaleTimeString("pt-BR");
    ctx.fillStyle = "#00d2ff";
    ctx.fillText(`TELEMETRIA SINCRONIZADA EM TEMPO REAL · ${now}`, w - 460, h - 34);

    return this.canvas;
  }
}

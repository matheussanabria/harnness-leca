import { officeScreenBrowserMethods } from "./office-screen-browser.js";
import { officeScreen57Methods } from "./office-screen-57.js";
import { officeScreenViewsMethods } from "./office-screen-views.js";
import { officeScreenPresets } from "./office/office-screen-presets.js";
import { officeState } from "./office-state.js";
// @ts-check
// Gerador de Textura Dinâmica em Alta Resolução para o Monitor 3D (2048x1152)

export class MonitorScreenRenderer {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 2048;
    this.canvas.height = 1152;
    this.ctx = this.canvas.getContext("2d");
    this.activeTab = "kanban";
    this.activePreset = "kanban";
    this.scrollOffset = 0;
    this.terminalLines = [
      "[DAI-Orquestrador] Inicializando workspace operacional...",
      "[Claude Code] Contexto carregado e memory.md sincronizado.",
      "[Gemini] Análise multimodal dos fluxos de trabalho concluída.",
      "[Codex] Serviços de plataforma e persistência integrados.",
      "[OpenCode] Serviço local escutando na porta 63186. 0 chamadas externas cobradas.",
      "[QA Engine] Suíte integral executada: 100% aprovada.",
      "[Dev] Sistema operacional. Aguardando novo comando do usuário...",
    ];
  }

  getCanvas() {
    return this.canvas;
  }

  setTab(tab) {
    this.activeTab = tab;
    this.activePreset = tab;
    this.render();
  }

  setPreset(presetId) {
    this.activePreset = presetId;
    this.activeTab = presetId;
    officeScreenPresets.setPreset("big_screen", presetId);
    this.render();
  }

  addTerminalLog(line) {
    this.terminalLines.push(line);
    if (this.terminalLines.length > 12) this.terminalLines.shift();
    this.render();
  }

  render(projectData = {}) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fundo do Sistema Operacional (Dark Minimalist)
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, w, h);

    // 1. Barra de Topo do Navegador / Sistema
    this.renderBrowserBar(ctx, w, h);

    // 2. Conteúdo da Aba/Preset Ativo
    const currentPreset = this.activePreset || officeScreenPresets.getPreset("big_screen");
    const projSlug = (projectData?.slug || officeState?.activeProject || "").toLowerCase();

    if (currentPreset === "kanban") {
      this.renderKanbanView(ctx, w, h, projectData);
    } else if (currentPreset === "metrics") {
      this.renderMetricsView(ctx, w, h);
    } else if (currentPreset === "terminal" || this.activeTab === "terminal") {
      this.renderTerminalView(ctx, w, h);
    } else if (currentPreset === "prototype" || this.activeTab === "design") {
      this.renderDesignView(ctx, w, h);
    } else if (projSlug.includes("57") || projSlug.includes("multimarcas")) {
      this.render57Multimarcas(ctx, w, h);
    } else {
      this.renderKanbanView(ctx, w, h, projectData);
    }

    // 3. Dock Inferior / Barra de Tarefas
    this.renderTaskbar(ctx, w, h);
  }

}

Object.assign(MonitorScreenRenderer.prototype, officeScreenBrowserMethods, officeScreen57Methods, officeScreenViewsMethods);

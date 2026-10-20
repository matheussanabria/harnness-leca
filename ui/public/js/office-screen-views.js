// @ts-check
// Terminal, design e barra de tarefas do monitor (mixin de MonitorScreenRenderer).

export const officeScreenViewsMethods = {
  renderEmbeddedTerminal(ctx, w, h) {
    const termY = h - 230;
    const termH = 175;

    ctx.fillStyle = "rgba(10, 15, 26, 0.94)";
    ctx.fillRect(40, termY, w - 80, termH);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, termY, w - 80, termH);

    // Header do Terminal
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(40, termY, w - 80, 32);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px monospace";
    ctx.fillText("[CLI] DAI Autonomous Dev Agent Terminal — Active Session [PID 1420]", 56, termY + 21);

    // Logs em tempo real
    ctx.font = "14px monospace";
    let ly = termY + 58;
    this.terminalLines.forEach((line, idx) => {
      if (line.includes("ERROR")) ctx.fillStyle = "#ef4444";
      else if (line.includes("aprovados") || line.includes("OK")) ctx.fillStyle = "#10b981";
      else if (line.includes("Claude") || line.includes("Gemini")) ctx.fillStyle = "#38bdf8";
      else ctx.fillStyle = "#cbd5e1";

      ctx.fillText(`> ${line}`, 56, ly);
      ly += 22;
    });

    // Cursor piscando
    const blink = Math.sin(Date.now() * 0.006) > 0;
    if (blink) {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(56, ly - 14, 10, 16);
    }
  },

  renderTerminalView(ctx, w, h) {
    const startY = 110;
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, startY, w, h - startY - 50);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 24px monospace";
    ctx.fillText("DAI AGENT COMMAND INTERFACE — ROOT SHELL", 60, startY + 60);

    ctx.font = "18px monospace";
    ctx.fillStyle = "#cbd5e1";
    let ty = startY + 110;
    [
      "[SYSTEM] Conectado ao cluster local do Harness Leca.",
      "[PROJECT] Workspace Operacional Ativo",
      "[ENGINES] Claude Code · Gemini 1.5 Pro · OpenCode · Codex",
      "[MEMORIES] Base de conhecimento e memory.md sincronizados.",
      "",
      "$ dai test --all",
      ">> All test suites passing (100%)",
      "$ git status",
      ">> On branch main: working tree clean.",
      ">> Changes ready for commit.",
      "$ npm run remote",
      ">> Remote tunnel listening at http://localhost:4321",
    ].forEach((l) => {
      ctx.fillText(l, 60, ty);
      ty += 34;
    });
  },

  renderDesignView(ctx, w, h) {
    const startY = 110;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, startY, w, h - startY - 50);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("DIS — Fluxo do Paciente (Protótipo Navegável)", 60, startY + 60);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px sans-serif";
    ctx.fillText("Protótipo interativo e catálogo de design system integrados ao ecossistema.", 60, startY + 95);

    // Wireframe de tela
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(60, startY + 130, w - 120, h - startY - 210, 16);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Painel de Dispensação e Controle Clínico", 100, startY + 190);
  },

  renderKanbanView(ctx, w, h, projectData) {
    const startY = 110;
    ctx.fillStyle = "#0a0f1d";
    ctx.fillRect(0, startY, w, h - startY - 50);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("KANBAN SCRUM — PROJEÇÃO DE FLUXO E RAIAS", 60, startY + 50);

    const lanes = [
      { title: "BACKLOG", count: 4, color: "#64748b" },
      { title: "EM ANDAMENTO", count: 2, color: "#38bdf8" },
      { title: "CODE REVIEW", count: 1, color: "#f59e0b" },
      { title: "CONCLUÍDO", count: 65, color: "#10b981" }
    ];

    const laneW = (w - 160) / lanes.length;
    const laneH = h - startY - 140;

    lanes.forEach((lane, i) => {
      const lx = 60 + i * (laneW + 15);
      const ly = startY + 80;

      ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
      ctx.beginPath();
      ctx.roundRect(lx, ly, laneW, laneH, 8);
      ctx.fill();
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = lane.color;
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${lane.title} (${lane.count})`, lx + 16, ly + 32);

      // Mini cards
      for (let c = 0; c < Math.min(lane.count, 4); c++) {
        const cy = ly + 50 + c * 75;
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.beginPath();
        ctx.roundRect(lx + 10, cy, laneW - 20, 65, 6);
        ctx.fill();
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "13px sans-serif";
        ctx.fillText(`HAR-${100 + i * 10 + c} Card de Entrega`, lx + 20, cy + 28);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px monospace";
        ctx.fillText("Status: Ativo · P1", lx + 20, cy + 48);
      }
    });
  },

  renderMetricsView(ctx, w, h) {
    const startY = 110;
    ctx.fillStyle = "#070c14";
    ctx.fillRect(0, startY, w, h - startY - 50);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("DATACENTER & CLUSTER METRICS — TELEMETRIA", 60, startY + 50);

    const metrics = [
      { label: "Uptime do Cluster", val: "99.98%", sub: "31 dias sem interrupção" },
      { label: "Testes Automatizados", val: "529 / 529", sub: "100% de sucesso" },
      { label: "Latência de Rede", val: "1.2 ms", sub: "Loopback / Localhost" },
      { label: "Motores Ativos", val: "Gemini + Codex", sub: "Claude/OpenCode em espera" }
    ];

    const cardW = (w - 180) / 4;
    metrics.forEach((m, i) => {
      const cx = 60 + i * (cardW + 20);
      const cy = startY + 90;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, 160, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.fillText(m.label, cx + 18, cy + 35);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(m.val, cx + 18, cy + 85);

      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText(m.sub, cx + 18, cy + 130);
    });
  },

  renderTaskbar(ctx, w, h) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, h - 46, w, 46);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, h - 46, w, 1);

    // Rótulos da barra de tarefas sem emojis
    const icons = ["[CORE] DAI", "[DIR] Projetos", "[CLI] Terminal", "[WEB] Preview", "[CFG] Config"];
    let ix = 40;
    ctx.font = "bold 13px -apple-system, sans-serif";
    for (const ico of icons) {
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(ix, h - 38, 140, 30, 6);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(ico, ix + 18, h - 18);
      ix += 155;
    }

    // Relógio no canto
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`${timeStr}  ·  DAI Station 01`, w - 210, h - 17);
  },
};

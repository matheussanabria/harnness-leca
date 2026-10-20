// @ts-check
// Barra e conteúdo do navegador no monitor (mixin de MonitorScreenRenderer).
import { officeState } from "./office-state.js";

export const officeScreenBrowserMethods = {
  renderBrowserBar(ctx, w, h) {
    // Barra de título da janela
    ctx.fillStyle = "#151c28";
    ctx.fillRect(0, 0, w, 56);

    // Botões fechar/minimizar/expandir (Mac style)
    ctx.fillStyle = "#ff5f56"; ctx.beginPath(); ctx.arc(28, 28, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffbd2e"; ctx.beginPath(); ctx.arc(52, 28, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#27c93f"; ctx.beginPath(); ctx.arc(76, 28, 8, 0, Math.PI * 2); ctx.fill();

    const activeSlug = officeState.activeProject || "projeto";
    const projLabel = activeSlug.toUpperCase();

    // Abas do Navegador
    const tabs = [
      { id: "project", label: `${projLabel} · Workspace`, w: 340 },
      { id: "terminal", label: "Terminal DAI · Claude & Gemini", w: 320 },
      { id: "design", label: "Protótipo Navegável", w: 280 }
    ];

    let tx = 110;
    for (const t of tabs) {
      const isActive = this.activeTab === t.id || (t.id === "project" && this.activeTab !== "terminal" && this.activeTab !== "design");
      ctx.fillStyle = isActive ? "#1e293b" : "#131922";
      ctx.beginPath();
      ctx.roundRect(tx, 10, t.w, 46, [8, 8, 0, 0]);
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = isActive ? "#ffffff" : "#94a3b8";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.fillText(t.label, tx + 20, 38);

      tx += t.w + 10;
    }

    // Barra de URL
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 56, w, 52);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(140, 64, w - 280, 36, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`http://localhost:4321/api/project/${activeSlug}/design/prototype`, 165, 87);
  },
};

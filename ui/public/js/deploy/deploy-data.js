// @ts-check
// Carga e persistência da configuração e do histórico de deploy.
import { dp } from "./deploy-store.js";
import { renderAll } from "./deploy-render.js";

export async function init() {
  await fetchConfig();
  await fetchHistory();
  renderAll();
}

export async function fetchConfig() {
  try {
    const res = await fetch("/api/deploy/config");
    if (res.ok) {
      const data = await res.json();
      if (data.config) {
        dp.deployConfig = data.config;
        localStorage.setItem("harness_deploy_config", JSON.stringify(dp.deployConfig));
      }
      if (data.availableProjects) dp.availableProjects = data.availableProjects;
      return;
    }
  } catch {}

  // Fallback para cache local se o servidor ainda não foi reiniciado
  try {
    const cached = localStorage.getItem("harness_deploy_config");
    if (cached) {
      const parsed = JSON.parse(cached);
      // Se continha a lista antiga automática com mais de 2 projetos incluindo saude-dispensacao, substitui
      if (parsed.projects && parsed.projects.length > 2 && parsed.projects.some((p) => p.id === "saude-dispensacao")) {
        localStorage.removeItem("harness_deploy_config");
      } else {
        dp.deployConfig = parsed;
      }
    }
    if (!dp.deployConfig.projects || dp.deployConfig.projects.length === 0) {
      dp.deployConfig.projects = [
        {
          id: "57multimarcas-web",
          name: "57 Multimarcas · Web",
          description: "Frontend / SPA hospedado no Easypanel (Hostinger VPS)",
          environments: [
            { id: "hom", name: "Homologação (HOM)", type: "staging", webhookUrl: "", method: "POST", requireConfirm: false },
            { id: "prod", name: "Produção (PROD)", type: "production", webhookUrl: "", method: "POST", requireConfirm: true },
          ],
        },
        {
          id: "57multimarcas-back",
          name: "57 Multimarcas · Backend",
          description: "API / Backend hospedado no Easypanel (Hostinger VPS)",
          environments: [
            { id: "hom", name: "Homologação (HOM)", type: "staging", webhookUrl: "", method: "POST", requireConfirm: false },
            { id: "prod", name: "Produção (PROD)", type: "production", webhookUrl: "", method: "POST", requireConfirm: true },
          ],
        },
      ];
      localStorage.setItem("harness_deploy_config", JSON.stringify(dp.deployConfig));
    }
  } catch (e) {
    console.warn("Erro ao ler cache local:", e);
  }
}

export async function fetchHistory() {
  try {
    const res = await fetch("/api/deploy/history");
    if (res.ok) {
      const data = await res.json();
      dp.deployHistory = data.history || [];
      localStorage.setItem("harness_deploy_history", JSON.stringify(dp.deployHistory));
      return;
    }
  } catch {}

  try {
    const cached = localStorage.getItem("harness_deploy_history");
    if (cached) dp.deployHistory = JSON.parse(cached);
  } catch {}
}

// @ts-check
// Carga e persistência da configuração e do histórico de deploy (EP-14.10).
// O histórico tem uma única fonte, `/api/deploy/history`; o estado da tela
// guarda apenas a configuração para a reserva offline do cliente.
import { dp } from "./deploy-store.js";
import { renderAll } from "./deploy-render.js";
import { loadScreen, patchScreen } from "../shared/screen-state.js";
import { defaultDeployConfig, hasDeployProjects, normalizeDeployState } from "./deploy-state.js";

export async function init() {
  await hydrateState();
  await fetchConfig();
  await fetchHistory();
  renderAll();
}

async function hydrateState() {
  try {
    dp.deployState = normalizeDeployState(await loadScreen("deploy"));
  } catch {
    dp.deployState = normalizeDeployState(null);
  }
}

export async function fetchConfig() {
  try {
    const res = await fetch("/api/deploy/config");
    if (res.ok) {
      const data = await res.json();
      if (data.config) {
        dp.deployConfig = data.config;
        dp.deployState.config = data.config;
        void saveConfigToState(data.config);
      }
      if (data.availableProjects) dp.availableProjects = data.availableProjects;
      return;
    }
  } catch {}

  if (hasDeployProjects(dp.deployState.config)) {
    dp.deployConfig = dp.deployState.config;
    return;
  }
  dp.deployConfig = defaultDeployConfig();
}

export async function fetchHistory() {
  try {
    const res = await fetch("/api/deploy/history");
    if (res.ok) {
      const data = await res.json();
      dp.deployHistory = Array.isArray(data.history) ? data.history : [];
      return dp.deployHistory;
    }
  } catch {}

  // Sem cópia local: uma falha de rede mantém apenas o histórico em memória.
  if (!Array.isArray(dp.deployHistory)) dp.deployHistory = [];
  return dp.deployHistory;
}

/** @param {unknown} config */
export async function saveConfigToState(config) {
  if (!config || typeof config !== "object") return false;
  try {
    await patchScreen("deploy", { config });
    return true;
  } catch {
    return false;
  }
}

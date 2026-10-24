// @ts-check
// Regras puras do estado da tela de deploy (EP-14.10).
// Sem DOM e sem I/O: normaliza o estado vindo do servidor e monta os patches.

export const DEPLOY_STATE_FIELDS = Object.freeze([
  "environment",
  "pipeline",
  "config",
  "selectedRun",
  "tab",
]);

/** Configuração inicial usada quando o servidor ainda não respondeu. */
export function defaultDeployConfig() {
  return {
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [
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
        id: "57multimarcas-api",
        name: "57 Multimarcas · Backend",
        description: "API / Backend hospedado no Easypanel (Hostinger VPS)",
        environments: [
          { id: "hom", name: "Homologação (HOM)", type: "staging", webhookUrl: "", method: "POST", requireConfirm: false },
          { id: "prod", name: "Produção (PROD)", type: "production", webhookUrl: "", method: "POST", requireConfirm: true },
        ],
      },
    ],
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/**
 * Normaliza o estado da tela de deploy sem confiar no formato recebido.
 * @param {unknown} raw
 */
export function normalizeDeployState(raw) {
  const state = isRecord(raw) ? raw : {};
  return {
    environment: text(state.environment, 120),
    pipeline: text(state.pipeline, 120),
    config: isRecord(state.config) ? state.config : null,
    selectedRun: text(state.selectedRun, 120),
    tab: text(state.tab, 32),
  };
}

/** @param {unknown} raw */
export function hasDeployProjects(raw) {
  return isRecord(raw) && Array.isArray(raw.projects) && raw.projects.length > 0;
}

/**
 * Monta o patch aceito pelo registro da tela de deploy.
 * @param {{ environment?: unknown, pipeline?: unknown, config?: unknown, selectedRun?: unknown, tab?: unknown }} values
 */
export function deployStatePatch(values = {}) {
  const patch = {};
  if ("environment" in values) patch.environment = text(values.environment, 120);
  if ("pipeline" in values) patch.pipeline = text(values.pipeline, 120);
  if ("selectedRun" in values) patch.selectedRun = text(values.selectedRun, 120);
  if ("tab" in values) patch.tab = text(values.tab, 32);
  if ("config" in values && isRecord(values.config)) patch.config = values.config;
  return patch;
}

// @ts-check
// Configuracao compartilhada do painel de deploy (EP-10.01).
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");

const CONFIG_FILE = path.join(ROOT, "global", "deployments.json");
const HISTORY_FILE = path.join(ROOT, "global", "deploy-history.json");

function defaultConfig() {
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

/**
 * Le a configuracao de deploys; cria o arquivo padrao quando ausente.
 * @returns {Object}
 */
function loadDeployConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[deploy-config] Erro ao ler deployments.json:", err.message);
  }
  const def = defaultConfig();
  saveDeployConfig(def);
  return def;
}

/**
 * Grava a configuracao de deploys.
 * @param {Object} config
 * @returns {boolean}
 */
function saveDeployConfig(config) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[deploy-config] Erro ao gravar deployments.json:", err.message);
    return false;
  }
}

/**
 * Mascara o segredo de uma URL de webhook.
 * @param {string} url
 * @returns {string}
 */
function maskWebhook(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("token")) {
      const token = parsed.searchParams.get("token") || "";
      if (token.length > 8) parsed.searchParams.set("token", `${token.slice(0, 4)}...${token.slice(-4)}`);
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]token=)([^&]{4})[^&]+/i, "$1$2...");
  }
}

/**
 * Localiza o webhook de um ambiente do painel de deploy.
 * @param {Object} config
 * @param {string} projectId
 * @param {string} envId
 * @returns {Object | null}
 */
function findEnvironment(config, projectId, envId) {
  const project = (config?.projects || []).find((item) => item.id === projectId);
  if (!project) return null;
  const env = (project.environments || []).find((item) => item.id === envId);
  if (!env) return null;
  return { project, env };
}

module.exports = {
  CONFIG_FILE,
  HISTORY_FILE,
  defaultConfig,
  loadDeployConfig,
  saveDeployConfig,
  maskWebhook,
  findEnvironment,
};

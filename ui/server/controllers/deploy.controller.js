// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { send, readJsonBody, slugs } = require("../config");
const { ROOT } = require("../../../tools/lib/root");

const DEPLOY_CONFIG_FILE = path.join(ROOT, "global", "deployments.json");
const DEPLOY_HISTORY_FILE = path.join(ROOT, "global", "deploy-history.json");

function getDefaultConfig() {
  return {
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [
      {
        id: "57multimarcas-web",
        name: "57 Multimarcas · Web",
        description: "Frontend / SPA hospedado no Easypanel (Hostinger VPS)",
        environments: [
          {
            id: "hom",
            name: "Homologação (HOM)",
            type: "staging",
            webhookUrl: "",
            method: "POST",
            requireConfirm: false,
          },
          {
            id: "prod",
            name: "Produção (PROD)",
            type: "production",
            webhookUrl: "",
            method: "POST",
            requireConfirm: true,
          },
        ],
      },
      {
        id: "57multimarcas-back",
        name: "57 Multimarcas · Backend",
        description: "API / Backend hospedado no Easypanel (Hostinger VPS)",
        environments: [
          {
            id: "hom",
            name: "Homologação (HOM)",
            type: "staging",
            webhookUrl: "",
            method: "POST",
            requireConfirm: false,
          },
          {
            id: "prod",
            name: "Produção (PROD)",
            type: "production",
            webhookUrl: "",
            method: "POST",
            requireConfirm: true,
          },
        ],
      },
    ],
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(DEPLOY_CONFIG_FILE)) {
      const raw = fs.readFileSync(DEPLOY_CONFIG_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[deploy.controller] Erro ao ler deployments.json:", err);
  }
  const def = getDefaultConfig();
  saveConfig(def);
  return def;
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(DEPLOY_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(DEPLOY_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[deploy.controller] Erro ao gravar deployments.json:", err);
    return false;
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(DEPLOY_HISTORY_FILE)) {
      const raw = fs.readFileSync(DEPLOY_HISTORY_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function saveHistory(history) {
  try {
    fs.mkdirSync(path.dirname(DEPLOY_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(DEPLOY_HISTORY_FILE, JSON.stringify(history.slice(0, 50), null, 2), "utf8");
  } catch (err) {
    console.error("[deploy.controller] Erro ao gravar deploy-history.json:", err);
  }
}

function maskWebhook(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.searchParams.has("token")) {
      const tok = u.searchParams.get("token") || "";
      if (tok.length > 8) {
        u.searchParams.set("token", tok.slice(0, 4) + "..." + tok.slice(-4));
      }
    }
    return u.toString();
  } catch {
    return url.replace(/([?&]token=)([^&]{4})[^&]+/i, "$1$2...");
  }
}

async function apiDeployConfigGet({ res }) {
  const config = loadConfig();
  return send(res, 200, { ok: true, config, availableProjects: slugs() });
}

async function apiDeployConfigSave({ req, res }) {
  try {
    const body = await readJsonBody(req);
    if (!body || !body.config || typeof body.config !== "object") {
      return send(res, 400, { error: "Configuração inválida enviada" });
    }
    saveConfig(body.config);
    return send(res, 200, { ok: true, config: body.config });
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
}

async function apiDeployTrigger({ req, res }) {
  try {
    const body = await readJsonBody(req);
    let { projectId, envId, webhookUrl, method, headers, payload } = body || {};

    let projectName = projectId || "Custom";
    let envName = envId || "Manual";

    // Se veio projectId e envId, busca na config se webhookUrl não foi informado
    if (projectId && envId) {
      const config = loadConfig();
      const proj = config.projects?.find((p) => p.id === projectId);
      if (proj) {
        projectName = proj.name || proj.id;
        const env = proj.environments?.find((e) => e.id === envId);
        if (env) {
          envName = env.name || env.id;
          if (!webhookUrl) webhookUrl = env.webhookUrl;
          if (!method) method = env.method || "POST";
        }
      }
    }

    if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.trim()) {
      return send(res, 400, { error: "URL do Webhook de deploy não configurada ou vazia." });
    }

    webhookUrl = webhookUrl.trim();
    if (!/^https?:\/\//i.test(webhookUrl)) {
      return send(res, 400, { error: "URL inválida. Deve começar com http:// ou https://" });
    }

    method = (method || "POST").toUpperCase();
    const reqHeaders = {
      "User-Agent": "Harness-Leca-Deployer/1.0",
      ...(headers || {}),
    };

    let reqBody = undefined;
    if (method !== "GET" && method !== "HEAD") {
      if (payload) {
        reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
        reqBody = typeof payload === "string" ? payload : JSON.stringify(payload);
      } else {
        // Easypanel webhooks normalmente aceitam body vazio ou json {}
        reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
        reqBody = JSON.stringify({});
      }
    }

    const start = Date.now();
    let status = 0;
    let statusText = "";
    let ok = false;
    let bodySnippet = "";
    let errorDetail = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const resp = await fetch(webhookUrl, {
        method,
        headers: reqHeaders,
        body: reqBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      status = resp.status;
      statusText = resp.statusText;
      ok = resp.ok;

      const rawText = await resp.text();
      bodySnippet = rawText.slice(0, 1000);
    } catch (fetchErr) {
      ok = false;
      status = fetchErr.name === "AbortError" ? 408 : 502;
      statusText = fetchErr.name === "AbortError" ? "Timeout (20s)" : "Erro de Conexão";
      errorDetail = fetchErr.message || String(fetchErr);
      bodySnippet = `Falha ao conectar no webhook: ${errorDetail}`;
    }

    const durationMs = Date.now() - start;

    const historyItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId,
      projectName,
      envId,
      envName,
      webhookMasked: maskWebhook(webhookUrl),
      method,
      status,
      statusText,
      ok,
      durationMs,
      snippet: bodySnippet,
    };

    const history = loadHistory();
    history.unshift(historyItem);
    saveHistory(history);

    return send(res, 200, {
      ok,
      status,
      statusText,
      durationMs,
      bodySnippet,
      historyItem,
    });
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
}

async function apiDeployHistoryGet({ res }) {
  const history = loadHistory();
  return send(res, 200, { ok: true, history });
}

async function apiDeployHistoryClear({ res }) {
  saveHistory([]);
  return send(res, 200, { ok: true });
}

module.exports = {
  apiDeployConfigGet,
  apiDeployConfigSave,
  apiDeployTrigger,
  apiDeployHistoryGet,
  apiDeployHistoryClear,
};

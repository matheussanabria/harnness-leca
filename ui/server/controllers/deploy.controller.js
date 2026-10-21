// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { send, readJsonBody, slugs } = require("../config");
const {
  HISTORY_FILE,
  loadDeployConfig,
  saveDeployConfig,
  maskWebhook,
} = require("../services/deploy/deploy-config.service");

const DEPLOY_HISTORY_FILE = HISTORY_FILE;
const loadConfig = loadDeployConfig;
const saveConfig = saveDeployConfig;

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

// @ts-check
// Linha do tempo unificada dos deploys, pipelines e medicoes de saude (EP-10.03).
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { maskWebhook } = require("./deploy-config.service");

const WEBHOOK_HISTORY_REL = path.join("global", "deploy-history.json");
const PIPELINE_RUNS_REL = path.join("global", "deploy-pipeline-runs.jsonl");
const HEALTH_RUNS_REL = path.join("global", "deploy-health-runs.jsonl");
const ACTIONS_REL = path.join("global", "deploy-actions.jsonl");
const KINDS = Object.freeze(["webhook", "pipeline", "saude", "acao"]);
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

function absolute(rel) {
  return path.join(ROOT, rel);
}

/**
 * Le um JSON de array, tolerando arquivo ausente ou corrompido.
 * @param {string} rel
 * @param {string} label
 * @returns {{ items: any[], warnings: string[] }}
 */
function readJsonArray(rel, label) {
  const file = absolute(rel);
  try {
    if (!fs.existsSync(file)) return { items: [], warnings: [] };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return { items: [], warnings: [`${label} invalido.`] };
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return { items: Array.isArray(parsed) ? parsed : [], warnings: [] };
  } catch {
    return { items: [], warnings: [`${label} invalido.`] };
  }
}

/**
 * Le um JSONL de objetos, tolerando arquivo ausente ou corrompido.
 * @param {string} rel
 * @param {string} label
 * @returns {{ items: any[], warnings: string[] }}
 */
function readJsonLines(rel, label) {
  const file = absolute(rel);
  try {
    if (!fs.existsSync(file)) return { items: [], warnings: [] };
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return { items: [], warnings: [`${label} invalido.`] };
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const items = [];
    let invalid = 0;
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === "object") items.push(parsed);
        else invalid += 1;
      } catch {
        invalid += 1;
      }
    }
    return {
      items,
      warnings: invalid ? [`${label}: ${invalid} linha(s) ignorada(s).`] : [],
    };
  } catch {
    return { items: [], warnings: [`${label} invalido.`] };
  }
}

function normalizeWebhook(item) {
  return {
    at: String(item?.timestamp || ""),
    kind: "webhook",
    projectId: String(item?.projectId || ""),
    projectName: String(item?.projectName || ""),
    envId: String(item?.envId || ""),
    envName: String(item?.envName || ""),
    status: item?.ok ? "sucesso" : "falha",
    ok: Boolean(item?.ok),
    durationMs: Number(item?.durationMs) || 0,
    summary: `${item?.method || "POST"} · ${item?.status || 0} ${item?.statusText || ""}`.trim(),
    detail: maskWebhook(String(item?.webhookMasked || item?.webhookUrl || "")),
    reference: String(item?.id || ""),
  };
}

function normalizePipeline(item) {
  const stages = Array.isArray(item?.stages) ? item.stages : [];
  const failed = stages.find((stage) => stage?.status === "failed");
  return {
    at: String(item?.startedAt || item?.finishedAt || ""),
    kind: "pipeline",
    projectId: String(item?.projectId || ""),
    projectName: String(item?.pipelineName || ""),
    envId: String(item?.envId || ""),
    envName: "",
    status: item?.status === "completed" ? "sucesso" : "falha",
    ok: item?.status === "completed",
    durationMs: stages.reduce((acc, stage) => acc + (Number(stage?.durationMs) || 0), 0),
    summary: `${item?.pipelineId || "pipeline"} · ${stages.length} estagio(s)${failed ? ` · falha em ${failed.id}` : ""}`,
    detail: String(item?.error || ""),
    reference: String(item?.id || ""),
  };
}

function normalizeHealth(item) {
  return {
    at: String(item?.at || ""),
    kind: "saude",
    projectId: String(item?.projectId || ""),
    projectName: "",
    envId: String(item?.envId || ""),
    envName: "",
    status: item?.ok ? "sucesso" : "falha",
    ok: Boolean(item?.ok),
    durationMs: Number(item?.latencyMs) || 0,
    summary: `${item?.checkId || "verificacao"} · ${item?.state || ""}`,
    detail: String(item?.detail || ""),
    reference: String(item?.checkId || ""),
  };
}

function normalizeAction(item) {
  return {
    at: String(item?.at || ""),
    kind: "acao",
    projectId: String(item?.projectId || ""),
    projectName: String(item?.actionType || ""),
    envId: String(item?.envId || ""),
    envName: "",
    status: item?.ok ? "sucesso" : "falha",
    ok: Boolean(item?.ok),
    durationMs: Number(item?.durationMs) || 0,
    summary: `${item?.actionId || "acao"} · ${item?.actor || ""}`.trim(),
    detail: String(item?.detail || ""),
    reference: String(item?.id || ""),
  };
}

/**
 * Constroi a linha do tempo unificada.
 * @param {{ projectId?: string, envId?: string, kind?: string, status?: string, limit?: number }} [filters]
 * @returns {Object}
 */
function buildTimeline(filters = {}) {
  const webhooks = readJsonArray(WEBHOOK_HISTORY_REL, "Historico de deploys");
  const pipelines = readJsonLines(PIPELINE_RUNS_REL, "Historico de pipelines");
  const health = readJsonLines(HEALTH_RUNS_REL, "Historico de medicoes");
  const actions = readJsonLines(ACTIONS_REL, "Historico de acoes");

  let entries = [
    ...webhooks.items.map(normalizeWebhook),
    ...pipelines.items.map(normalizePipeline),
    ...health.items.map(normalizeHealth),
    ...actions.items.map(normalizeAction),
  ];
  entries.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const projectId = String(filters.projectId || "").trim();
  const envId = String(filters.envId || "").trim();
  const kind = String(filters.kind || "").trim();
  const status = String(filters.status || "").trim();

  if (projectId) entries = entries.filter((entry) => entry.projectId === projectId);
  if (envId) entries = entries.filter((entry) => entry.envId === envId);
  if (kind) entries = entries.filter((entry) => entry.kind === kind);
  if (status) entries = entries.filter((entry) => entry.status === status);

  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const totals = {
    webhook: entries.filter((entry) => entry.kind === "webhook").length,
    pipeline: entries.filter((entry) => entry.kind === "pipeline").length,
    saude: entries.filter((entry) => entry.kind === "saude").length,
    acao: entries.filter((entry) => entry.kind === "acao").length,
  };
  return {
    ok: true,
    entries: entries.slice(0, limit),
    totals: { ...totals, total: entries.length, returned: Math.min(entries.length, limit) },
    kinds: KINDS,
    warnings: [...webhooks.warnings, ...pipelines.warnings, ...health.warnings, ...actions.warnings],
  };
}

module.exports = {
  KINDS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  WEBHOOK_HISTORY_REL,
  PIPELINE_RUNS_REL,
  HEALTH_RUNS_REL,
  ACTIONS_REL,
  readJsonArray,
  readJsonLines,
  normalizeWebhook,
  normalizePipeline,
  normalizeHealth,
  normalizeAction,
  buildTimeline,
};

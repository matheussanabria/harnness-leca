// @ts-check
// API do event log e do stream recuperavel (EP-09.02).
// Leitura: eventos por cursor, projecoes e stream SSE. Escrita: publicacao de evento.
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send } = require("../config");
const { readEvents, storeStats } = require("../services/events/event-store");
const { projectSessions, projectWorkflows, projectAttention } = require("../services/events/event-projector");
const { createEventStream, resolveResumeCursor } = require("../services/events/event-stream");
const { ingestEvent, IngestError } = require("../services/events/event-ingest");
const { getPresenceStats } = require("../services/external-presence/presence-runtime");
const { getUsageStats } = require("../services/usage-ingest/usage-runtime");
const { summarizeUsage, GROUPS } = require("../services/usage-ingest/usage-summary");

const { getQuotaStore } = require("../services/usage-ingest/quota-store");
const { loadPlanConfig } = require("../services/usage-ingest/quota-plans-config");
const { buildQuotas } = require("../services/usage-ingest/quota-merge");
const { createNineRouterReader } = require("../services/usage-ingest/9router-reader");
const { createOpenCodeReader } = require("../services/usage-ingest/opencode-reader");
const { createGeminiActivityReader } = require("../services/usage-ingest/gemini-activity-reader");
const { readRoutingOutcomes } = require("../services/usage-ingest/routing-outcomes-reader");
const { parseUsageRange } = require("../services/usage-ingest/usage-range");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/**
 * @param {any} req
 * @param {string} name
 * @returns {string}
 */
function queryParam(req, name) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    return String(url.searchParams.get(name) || "").trim();
  } catch {
    return "";
  }
}

/**
 * @param {any} req
 * @param {string} name cabecalho em minusculas
 * @returns {string}
 */
function headerValue(req, name) {
  const value = req?.headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

/**
 * @param {string} slug
 * @returns {boolean}
 */
function projectExists(slug) {
  const dir = path.join(getProjects(), slug);
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** GET /api/project/:slug/events */
async function apiProjectEvents({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const types = queryParam(req, "types").split(",").map((item) => item.trim()).filter(Boolean);
  const { events, cursor } = readEvents(slug, {
    cursor: queryParam(req, "cursor"),
    limit: Number(queryParam(req, "limit")) || 200,
    types,
    sessionId: queryParam(req, "sessionId"),
  });
  return send(res, 200, { events, cursor, stats: storeStats(slug), presence: getPresenceStats(), usage: getUsageStats() });
}

/** GET /api/project/:slug/usage/summary?since=<iso>|window=24h|7d|14d|all&until=<iso>&groupBy=day|model|session|origin|engine */
async function apiProjectUsageSummary({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const groupBy = queryParam(req, "groupBy");
  const range = parseUsageRange({ since: queryParam(req, "since"), window: queryParam(req, "window"), until: queryParam(req, "until") });
  if ("error" in range) return send(res, 400, { error: range.error });
  if (groupBy && !Object.hasOwn(GROUPS, groupBy)) return send(res, 400, { error: "groupBy deve ser day, model, session, origin ou engine." });
  const ingest = getUsageStats();
  return send(res, 200, {
    ...summarizeUsage(slug, {
      ...range,
      groupBy: /** @type {any} */ (groupBy || null),
      linesUnparsable: ingest.enabled ? ingest.linesUnparsable : null,
    }),
    ingest: { enabled: ingest.enabled },
  });
}

/** @type {ReturnType<typeof createNineRouterReader> | null} */
let nineRouterReader = null;

/** GET /api/usage/combos (global, read-only): per combo/provider/model call and token totals from the 9Router DB */
async function apiUsageCombos({ res }) {
  nineRouterReader = nineRouterReader || createNineRouterReader();
  const { combos, warnings } = nineRouterReader.read();
  return send(res, 200, { generatedAt: new Date().toISOString(), combos, warnings });
}

/** @type {ReturnType<typeof createOpenCodeReader> | null} */
let openCodeReader = null;

/** GET /api/usage/opencode (global, read-only): per provider/model totals from the OpenCode DB; 9router calls reported apart */
async function apiUsageOpenCode({ res }) {
  openCodeReader = openCodeReader || createOpenCodeReader();
  const { stats, total, viaRouter, layout, warnings } = openCodeReader.read();
  return send(res, 200, { generatedAt: new Date().toISOString(), source: "opencode", layout, stats, total, viaRouter, warnings });
}

/** @type {ReturnType<typeof createGeminiActivityReader> | null} */
let geminiReader = null;

/** GET /api/usage/gemini (global, read-only): per-day step counts from Antigravity transcripts (no token data exists there) */
async function apiUsageGemini({ res }) {
  geminiReader = geminiReader || createGeminiActivityReader();
  const { days, sessions, partial, warnings } = geminiReader.read();
  return send(res, 200, { generatedAt: new Date().toISOString(), source: "gemini-transcripts", tokens: null, days, sessions, partial, warnings });
}

/** GET /api/usage/routing (global, read-only): Harness-side combo outcomes and fallbacks (9Router keeps no failure data) */
async function apiUsageRouting({ res }) {
  const { combos, fallbacks, warnings } = readRoutingOutcomes();
  return send(res, 200, { generatedAt: new Date().toISOString(), source: "hia-telemetry", combos, fallbacks, warnings });
}

/** GET /api/usage/quotas (global, read-only): latest quota snapshots per provider+window plus configured plans */
async function apiUsageQuotas({ res }) {
  return send(res, 200, buildQuotas({ stored: getQuotaStore().list(), config: loadPlanConfig(), nowMs: Date.now() }));
}

/** GET /api/project/:slug/projections */
async function apiProjectProjections({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const sessions = projectSessions(slug);
  const workflows = projectWorkflows(slug);
  const attention = projectAttention(slug);
  return send(res, 200, {
    sessions: sessions.sessions,
    workflows: workflows.executions,
    attention: attention.items,
    cursor: sessions.cursor,
  });
}

/** GET /api/project/:slug/sessions/stream */
async function apiProjectEventStream({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Stream restrito ao loopback." });
  const types = queryParam(req, "types").split(",").map((item) => item.trim()).filter(Boolean);
  const stream = createEventStream(slug, {
    res,
    cursor: resolveResumeCursor(headerValue(req, "last-event-id"), queryParam(req, "cursor")),
    types,
    sessionId: queryParam(req, "sessionId"),
  });
  req?.on?.("close", () => stream.close());
  res?.on?.("close", () => stream.close());
  // O handle volta para quem chamou: permite fechar o stream em testes e no desligamento.
  return stream;
}

/** POST /api/project/:slug/events */
async function apiProjectEventPublish({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Publicação restrita ao loopback." });
  let body;
  try {
    body = JSON.parse(await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 256 * 1024) reject(new Error("Corpo grande demais."));
      });
      req.on("end", () => resolve(raw || "{}"));
      req.on("error", reject);
    }));
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : "Corpo inválido." });
  }
  try {
    const result = ingestEvent(slug, body);
    return send(res, 201, { event: result.event, cursor: result.cursor, duplicated: result.duplicated, sanitized: result.sanitized });
  } catch (err) {
    // Mensagem publica generica e estavel; detalhe interno nunca vai ao cliente.
    if (err instanceof IngestError) return send(res, err.status, { error: err.message, code: err.code });
    throw err;
  }
}

module.exports = { apiProjectEvents, apiProjectUsageSummary, apiUsageQuotas, apiUsageCombos, apiUsageOpenCode, apiUsageGemini, apiUsageRouting, apiProjectProjections, apiProjectEventStream, apiProjectEventPublish };

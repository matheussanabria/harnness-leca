// @ts-check
// API do event log e do stream recuperavel (EP-09.02).
// Leitura: eventos por cursor, projecoes e stream SSE. Escrita: publicacao de evento.
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send } = require("../config");
const { readEvents, storeStats } = require("../services/events/event-store");
const { projectSessions, projectWorkflows, projectAttention } = require("../services/events/event-projector");
const { createEventStream, publish } = require("../services/events/event-stream");

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
  return send(res, 200, { events, cursor, stats: storeStats(slug) });
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
    cursor: queryParam(req, "cursor"),
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
  const result = publish(slug, body);
  return send(res, 201, { event: result.event, cursor: result.cursor, duplicated: result.duplicated });
}

module.exports = { apiProjectEvents, apiProjectProjections, apiProjectEventStream, apiProjectEventPublish };

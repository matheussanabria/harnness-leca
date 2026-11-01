// @ts-check
// Controller para API de Atenção Unificada (EP-09.05).
// GET: lista fila unificada; POST /:id/ack: reconhecer; POST /:id/resolve: resolver.

const netLib = require("../../../tools/lib/network");
const { send } = require("../config");
const {
  getUnifiedAttentionQueue,
  acknowledgeAttentionItem,
  resolveAttentionItem,
} = require("../services/attention-queue.service");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/** GET /api/project/:slug/attention */
async function apiProjectAttentionQueue({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  const url = new URL(req?.url || "", "http://localhost");
  const includeResolved = url.searchParams.get("includeResolved") === "true";
  const queue = getUnifiedAttentionQueue(slug, { includeResolved });
  return send(res, 200, queue);
}

/** POST /api/project/:slug/attention/:id/ack */
async function apiProjectAttentionAck({ req, res, params: [slug, id] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!id) return send(res, 400, { error: "ID de atenção obrigatório." });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Ação restrita ao loopback." });

  try {
    const result = acknowledgeAttentionItem(slug, id, { actor: "user" });
    return send(res, 200, { ok: true, result });
  } catch (err) {
    return send(res, 500, { error: err?.message || "Erro ao reconhecer item." });
  }
}

/** POST /api/project/:slug/attention/:id/resolve */
async function apiProjectAttentionResolve({ req, res, params: [slug, id] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!id) return send(res, 400, { error: "ID de atenção obrigatório." });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Ação restrita ao loopback." });

  let body = {};
  try {
    body = JSON.parse(await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 64 * 1024) reject(new Error("Corpo grande demais."));
      });
      req.on("end", () => resolve(raw || "{}"));
      req.on("error", reject);
    }));
  } catch {}

  try {
    const result = resolveAttentionItem(slug, id, { actor: body.actor || "user", note: body.note || "" });
    return send(res, 200, { ok: true, result });
  } catch (err) {
    return send(res, 500, { error: err?.message || "Erro ao resolver item." });
  }
}

module.exports = {
  apiProjectAttentionQueue,
  apiProjectAttentionAck,
  apiProjectAttentionResolve,
};

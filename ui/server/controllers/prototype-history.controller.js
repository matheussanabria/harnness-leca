// @ts-check
const path = require("path");
const { getProjects, send, postOk } = require("../config");
const History = require("../services/prototype-history.service");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error("Corpo excede o limite."));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON inválido no corpo.")); }
    });
    req.on("error", reject);
  });
}

const projectDirOf = (slug) => path.join(getProjects(), slug);
const notFound = (message) => /não encontrado/.test(message) ? 404 : 400;

/** GET /api/project/:slug/design/prototypes/:protoId/history */
async function apiPrototypesHistoryList({ res, params: [slug, protoId] }) {
  try {
    return send(res, 200, { ok: true, ...History.listHistory(projectDirOf(slug), protoId) });
  } catch (err) {
    const message = err.message || String(err);
    return send(res, notFound(message), { error: message });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/history/(undo|redo|goto)  { index? } */
function move(action) {
  return async function apiPrototypesHistoryMove({ req, res, params: [slug, protoId] }) {
    if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
    try {
      const body = await readJsonBody(req);
      const projectDir = projectDirOf(slug);
      const result = action === "undo" ? History.undoHistory(projectDir, protoId)
        : action === "redo" ? History.redoHistory(projectDir, protoId)
          : History.goToEntry(projectDir, protoId, Number(body.index));
      if (!result.ok) return send(res, 400, { error: result.error });
      return send(res, 200, result);
    } catch (err) {
      const message = err.message || String(err);
      return send(res, notFound(message), { error: message });
    }
  };
}

/** POST .../history/checkpoint  { name, index? }: marca o estado atual (ou a entrada `index`) como ponto nomeado */
async function apiPrototypesHistoryCheckpoint({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  try {
    const body = await readJsonBody(req);
    const result = History.markCheckpoint(projectDirOf(slug), protoId, body.name, Number.isInteger(body.index) ? body.index : undefined);
    if (!result.ok) return send(res, 400, { error: result.error });
    return send(res, 200, result);
  } catch (err) {
    const message = err.message || String(err);
    return send(res, notFound(message), { error: message });
  }
}

module.exports = {
  apiPrototypesHistoryCheckpoint,
  apiPrototypesHistoryList,
  apiPrototypesHistoryUndo: move("undo"),
  apiPrototypesHistoryRedo: move("redo"),
  apiPrototypesHistoryGoto: move("goto"),
};

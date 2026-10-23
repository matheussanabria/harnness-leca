// @ts-check
const path = require("path");
const { getProjects, send, postOk } = require("../config");
const { removeComponentCandidate } = require("../services/prototype-structural.service");
const { deletePrototype } = require("../services/prototype-delete.service");
const History = require("../services/prototype-history.service");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error("Corpo excede o limite."));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON inválido no corpo.")); }
    });
    req.on("error", reject);
  });
}

/** POST /api/project/:slug/design/prototypes/:protoId/unextract-component  { id?, pid?, screen? } */
async function apiPrototypesUnextractComponent({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  try {
    const body = await readJsonBody(req);
    const projectDir = path.join(getProjects(), slug);
    const result = History.withHistory(projectDir, protoId, { label: "Desfazer extração de componente", kind: "component" }, () => removeComponentCandidate(projectDir, protoId, body));
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/delete — pasta vai para a lixeira do projeto */
async function apiPrototypesDelete({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  try {
    return send(res, 200, deletePrototype(path.join(getProjects(), slug), protoId));
  } catch (err) {
    const message = err.message || String(err);
    return send(res, /não encontrado/.test(message) ? 404 : 400, { error: message });
  }
}

module.exports = { apiPrototypesUnextractComponent, apiPrototypesDelete };

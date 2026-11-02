// @ts-check
// GET /api/project/:slug/coordination/lanes: read-only ledger lanes for the Scrum board.
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { buildCoordinationView, readLedger } = require("../services/coordination-view");

/** @param {any} ctx */
async function apiProjectCoordinationLanes({ res, params: [slug] }) {
  try {
    if (!fs.existsSync(path.join(getProjects(), slug))) {
      return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
    }
    const state = readLedger(getProjects(), slug);
    if (!state) return send(res, 200, { ok: true, available: false, view: buildCoordinationView(null) });
    return send(res, 200, { ok: true, available: true, view: buildCoordinationView(state) });
  } catch (err) {
    return send(res, 500, { error: `Falha ao ler o ledger de coordenação: ${/** @type {Error} */ (err).message}` });
  }
}

module.exports = { apiProjectCoordinationLanes };

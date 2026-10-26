// @ts-check
// Controller para o scratchpad temporário de protótipos do Ateliê (EP-15.01).
const path = require("path");
const { getProjects, send } = require("../config");
const {
  listScratchFiles,
  readScratchFile,
  writeScratchFile,
  cleanScratchDir,
} = require("../services/atelier-scratchpad.service");

/** GET /api/project/:slug/design/prototypes/:protoId/scratch */
async function apiPrototypesScratchList({ res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const files = listScratchFiles(projectDir, protoId);
    return send(res, 200, { ok: true, protoId, files });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/design/prototypes/:protoId/scratch/:filename */
async function apiPrototypesScratchGet({ res, params: [slug, protoId, filename] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const file = readScratchFile(projectDir, protoId, filename);
    return send(res, 200, { ok: true, protoId, ...file });
  } catch (err) {
    return send(res, 404, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/scratch/clean */
async function apiPrototypesScratchClean({ res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const result = cleanScratchDir(projectDir, protoId);
    return send(res, 200, { ok: true, protoId, ...result });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

module.exports = {
  apiPrototypesScratchList,
  apiPrototypesScratchGet,
  apiPrototypesScratchClean,
};

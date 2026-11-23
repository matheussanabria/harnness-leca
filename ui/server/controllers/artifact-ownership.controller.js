// @ts-check
// Ownership operations on registered artifacts (EP-25.04): preview, move, copy and undo.
// POST /api/artifacts/:id/{preview|reassign|copy|undo}. The server enforces `confirmado: true` for moves.
const { send, readJsonBody, getProjects } = require("../config");
const { getStore } = require("../services/artifacts/artifact-registry.service");
const { ArtifactError } = require("../services/artifacts/artifact-errors");
const ownership = require("../services/artifacts/artifact-reassign.service");

/** @param {import("http").ServerResponse} res @param {unknown} error */
function fail(res, error) {
  if (error instanceof ArtifactError) return send(res, error.status, { error: error.message, code: error.code, details: error.details });
  console.error("[artifact-ownership]", (error && /** @type {any} */ (error).stack) || error);
  return send(res, 500, { error: "Não foi possível concluir a operação. O detalhe está no terminal do servidor." });
}

/**
 * @param {(ctx: any, id: string, body: any) => unknown} run
 * @param {number} [okStatus]
 */
function operation(run, okStatus = 200) {
  return async (/** @type {{ req: any, res: import("http").ServerResponse, params: string[] }} */ { req, res, params }) => {
    const repo = getStore();
    if (!repo) return send(res, 503, { error: "O registro de artefatos está desligado.", code: "REGISTRY_OFF" });
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return send(res, 400, { error: "JSON inválido" });
    }
    try {
      const result = run({ repo, projectsDir: getProjects(), actor: "web" }, params[0], body || {});
      return send(res, okStatus, result);
    } catch (error) {
      return fail(res, error);
    }
  };
}

const apiArtifactPreview = operation((ctx, id, b) => ownership.previewOwnership(ctx, id, b.destino, b.modo === "copy" ? "copy" : "move"));
const apiArtifactReassign = operation((ctx, id, b) => ownership.reassign(ctx, id, b.destino, { confirmado: b.confirmado }));
const apiArtifactCopy = operation((ctx, id, b) => ownership.copyArtifact(ctx, id, b.destino), 201);
const apiArtifactUndo = operation((ctx, id, b) => ownership.undoReassign(ctx, id, b.logId));

module.exports = { apiArtifactPreview, apiArtifactReassign, apiArtifactCopy, apiArtifactUndo };

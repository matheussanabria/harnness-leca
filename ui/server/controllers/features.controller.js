// @ts-check
// GET /api/features: the feature manifest with availability for the current scope (EP-25.01, EP-25.02).
const { send } = require("../config");
const { FEATURES, availability } = require("../features/manifest");
const { resolveScope } = require("../scope/resolve-scope");

async function apiFeatures({ req, res }) {
  // No header means "no project" here: the manifest must not depend on the last used project.
  const scope = resolveScope(req, { fallbackActive: false });
  if (!scope.ok) return send(res, 404, { error: scope.error });
  return send(res, 200, { projeto: scope.projectSlug, funcionalidades: availability(FEATURES, scope.projectSlug) });
}

module.exports = { apiFeatures };

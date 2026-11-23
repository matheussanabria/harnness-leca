// @ts-check
// GET /api/features: the feature manifest with availability for the current scope (EP-25.01).
const { send } = require("../config");
const { FEATURES, availability } = require("../features/manifest");

/** Reads the project slug from the X-Harness-Project header; empty means "no project". */
function scopeSlug(req) {
  const raw = req && req.headers ? req.headers["x-harness-project"] : "";
  const slug = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug) ? slug : null;
}

async function apiFeatures({ req, res }) {
  const slug = scopeSlug(req);
  return send(res, 200, { projeto: slug, funcionalidades: availability(FEATURES, slug) });
}

module.exports = { apiFeatures, scopeSlug };

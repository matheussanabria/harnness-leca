// @ts-check
"use strict";
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { loadQualityContext } = require("../services/atelier-quality.service");

/** GET /api/project/:slug/design/atelier/quality-context */
async function apiAtelierQualityContext({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  return send(res, 200, loadQualityContext(projectDir));
}

module.exports = { apiAtelierQualityContext };

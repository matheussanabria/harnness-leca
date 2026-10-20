// @ts-check
// Fachada de project-screens.service: reexporta a API pública dos módulos (project-screens-canvas, project-screens-logic, project-screens-sistema, project-screens-fallback).
const { parseScreensFromCanvasHtml } = require("./project-screens-canvas");
const { getProjectScreens } = require("./project-screens-fallback");

module.exports = { getProjectScreens, parseScreensFromCanvasHtml };

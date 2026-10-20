// @ts-check
const fs = require("fs");
const path = require("path");
const { renderSandboxScreen } = require("./prototype-sandbox-renderer.service");

/**
 * Renderiza uma tela de protótipo montada com tokens, estilos e a ponte postMessage.
 * Delega para a engine modular de sandbox segura.
 * @param {string} projectDir
 * @param {string} repoRoot
 * @param {string} protoId
 * @param {string} screenId
 * @param {object} [context]
 * @param {object} [deps]
 */
function renderPrototypeScreen(projectDir, repoRoot, protoId, screenId, context = {}, deps = { fs, path }) {
  return renderSandboxScreen(projectDir, repoRoot, protoId, screenId, { context }, deps);
}

module.exports = {
  renderPrototypeScreen,
};

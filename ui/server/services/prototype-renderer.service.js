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
 * @param {{ part?: string }} [options] part "content": so a area de conteudo da tela, sem cabecalho e menu
 */
function renderPrototypeScreen(projectDir, repoRoot, protoId, screenId, context = {}, deps = { fs, path }, options = {}) {
  return renderSandboxScreen(projectDir, repoRoot, protoId, screenId, { context, part: options.part }, deps);
}

module.exports = {
  renderPrototypeScreen,
};

// @ts-check
const { generateVanillaScreen } = require("./prototype-codegen-vanilla.service");
const { generateAngularScreen } = require("./prototype-codegen-angular.service");
const { generateReactScreen } = require("./prototype-codegen-react.service");

/**
 * @typedef {'vanilla' | 'angular18' | 'react18'} SupportedFramework
 */

const SUPPORTED_FRAMEWORKS = ["vanilla", "angular18", "react18"];

/**
 * Fábrica unificada de geração de código multiframework a partir da árvore semântica.
 * @param {SupportedFramework | string} framework
 * @param {any} screen
 * @param {any} proto
 * @param {object} [options]
 */
function generateScreenCode(framework, screen, proto, options = {}) {
  const norm = (framework || "vanilla").toLowerCase().trim();

  switch (norm) {
    case "vanilla":
    case "html":
      return generateVanillaScreen(screen, proto, options);

    case "angular":
    case "angular18":
      return generateAngularScreen(screen, proto, options);

    case "react":
    case "react18":
      return generateReactScreen(screen, proto, options);

    default:
      throw new Error(`Framework '${framework}' não suportado. Opções válidas: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
  }
}

/**
 * Retorna os frameworks suportados pela factory.
 * @returns {string[]}
 */
function getSupportedFrameworks() {
  return [...SUPPORTED_FRAMEWORKS];
}

module.exports = {
  generateScreenCode,
  getSupportedFrameworks,
  SUPPORTED_FRAMEWORKS,
};

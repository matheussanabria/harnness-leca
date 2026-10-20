// @ts-check
const { listComponents, resolveComponentFiles } = require("./component-resolver.service");
const { locateElementInTemplate } = require("./template-locator.service");
const { applyComponentEdit } = require("./component-editor.service");

/**
 * Adaptador para aplicações Angular
 */
class AngularFrameworkAdapter {
  constructor(config = {}) {
    this.name = "angular";
    this.config = config;
  }

  listComponents(repoRoot, options = {}) {
    return listComponents(repoRoot, options);
  }

  resolveComponentFiles(componentName, repoRoot, options = {}) {
    return resolveComponentFiles(componentName, repoRoot, options);
  }

  locateElement(templateContent, target) {
    return locateElementInTemplate(templateContent, target);
  }

  applyEdit(options) {
    return applyComponentEdit(options);
  }
}

/**
 * Adaptador para protótipos em HTML estático
 */
class StaticHtmlFrameworkAdapter {
  constructor(config = {}) {
    this.name = "static-html";
    this.config = config;
  }

  listComponents() {
    return [];
  }

  resolveComponentFiles() {
    return { found: false, error: "Projeto usa protótipos em HTML estático." };
  }

  locateElement(content, target) {
    return { found: false, error: "Localização de templates em HTML estático usa data-pid." };
  }

  applyEdit() {
    return { ok: false, error: "Edições em HTML estático são tratadas pelo Ateliê." };
  }
}

/**
 * Adaptador nulo (somente inspeção no navegador)
 */
class NullFrameworkAdapter {
  constructor(config = {}) {
    this.name = "none";
    this.config = config;
  }
  listComponents() { return []; }
  resolveComponentFiles() { return { found: false, error: "Framework adapter desativado (none)." }; }
  locateElement() { return { found: false, error: "Edição direta desativada para este projeto." }; }
  applyEdit() { return { ok: false, error: "Operação não suportada." }; }
}

/**
 * Fábrica de adaptadores de framework.
 * @param {object} frameworkConfig
 */
function createFrameworkAdapter(frameworkConfig) {
  const adapterName = frameworkConfig?.adapter || "none";
  if (adapterName === "angular") {
    return new AngularFrameworkAdapter(frameworkConfig);
  }
  if (adapterName === "static-html") {
    return new StaticHtmlFrameworkAdapter(frameworkConfig);
  }
  return new NullFrameworkAdapter(frameworkConfig);
}

module.exports = {
  createFrameworkAdapter,
  AngularFrameworkAdapter,
  StaticHtmlFrameworkAdapter,
  NullFrameworkAdapter,
};

// @ts-check
// Fachada de template-locator.service: reexporta a API pública dos módulos (template-locator-nodes, template-locator-find).
const { parseTemplateNodes } = require("./template-locator-nodes");
const { locateElementInTemplate } = require("./template-locator-find");

module.exports = { parseTemplateNodes, locateElementInTemplate };

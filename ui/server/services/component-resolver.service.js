// @ts-check
// Fachada de component-resolver.service: reexporta a API pública dos módulos (component-resolver-utils, component-resolver-parse, component-resolver-resolve).
const { isInside, normalizeComponentName } = require("./component-resolver-utils");
const { parseComponentMetadata } = require("./component-resolver-parse");
const { resolveComponent, readComponentFile, listComponents } = require("./component-resolver-resolve");

module.exports = { isInside, normalizeComponentName, parseComponentMetadata, resolveComponent, readComponentFile, listComponents };

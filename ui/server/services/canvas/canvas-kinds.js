// @ts-check
const { invalidSchema } = require("./canvas-errors");

/**
 * Registry of board kinds (ADR-014). The server keeps `data` opaque; a kind may only
 * declare a shallow shape check so a client cannot store another editor's format by mistake.
 * Deep validation (graph rules, Mermaid syntax) belongs to the client of each kind.
 */

const MAX_DIAGRAM_SOURCE_BYTES = 64 * 1024;

/** @param {unknown} value */
const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** @param {Record<string, unknown>} data */
function checkDiagram(data) {
  const { source, diagramType } = data;
  if (data.schema !== "mermaid@1") return false;
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_DIAGRAM_SOURCE_BYTES) return false;
  return typeof diagramType === "string" && diagramType.length > 0 && diagramType.length <= 40;
}

/** @param {Record<string, unknown>} data */
function checkFlow(data) {
  if (data.schema !== "flow@1") return false;
  const graph = data.graph;
  if (!isObject(graph)) return false;
  const { nodes, edges } = /** @type {Record<string, unknown>} */ (graph);
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return false;
  return data.layout === undefined || isObject(data.layout);
}

/**
 * `check` is absent for kinds whose content the server never inspects.
 * @type {Readonly<Record<string, { check?: (data: Record<string, unknown>) => boolean }>>}
 */
const KIND_REGISTRY = Object.freeze({
  board: {},
  mindmap: {},
  diagram: { check: checkDiagram },
  flow: { check: checkFlow },
});

const KINDS = Object.freeze(Object.keys(KIND_REGISTRY));

/**
 * Shape check for a kind. An empty object is the blank board a client creates before its
 * first save, so it is accepted only when `allowBlank` is set (create), never on update.
 * @param {string} kind
 * @param {Record<string, unknown>} data
 * @param {{ allowBlank?: boolean }} [options]
 * @returns {Record<string, unknown>}
 */
function checkKindData(kind, data, options = {}) {
  const check = KIND_REGISTRY[kind]?.check;
  if (!check) return data;
  if (options.allowBlank && Object.keys(data).length === 0) return data;
  if (!check(data)) throw invalidSchema(kind);
  return data;
}

module.exports = { KINDS, KIND_REGISTRY, MAX_DIAGRAM_SOURCE_BYTES, checkKindData };

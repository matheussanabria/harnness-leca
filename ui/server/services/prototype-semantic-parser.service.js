// @ts-check

/**
 * Mapeia identificadores de componentes globais do DIS para IDs canônicos do Registry.
 */
const COMPONENT_GLOBAL_MAP = {
  "DS.AnnotationList": "dis.annotation-list",
  "DS.Accordion": "dis.accordion",
  "DS.Button": "dis.button",
  "DS.Icon": "dis.icon",
  "DS.PatientHeader": "dis.patient-header",
  "DS.Header": "dis.header",
  "DS.Footer": "dis.footer",
  "DS.DataTable": "dis.data-table",
  "DS.SearchField": "dis.search-field",
  "DS.DispensationItem": "dis.dispensation-item",
  "DS.DispensationCalc": "dis.dispensation-calc",
  "DS.Alert": "dis.alert",
  "DS.Modal": "dis.modal",
};

/**
 * Converte kebab-case para camelCase.
 * @param {string} str
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converte PascalCase para kebab-case.
 * @param {string} str
 */
function pascalToKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Resolve o componentId a partir do nome global.
 * @param {string} globalName Ex: "DS.AnnotationList" ou "DS.CustomCard"
 */
function resolveComponentId(globalName) {
  if (COMPONENT_GLOBAL_MAP[globalName]) {
    return COMPONENT_GLOBAL_MAP[globalName];
  }
  const clean = globalName.replace(/^DS\./, "");
  return `dis.${pascalToKebab(clean)}`;
}

/**
 * Extrai atributos de uma tag HTML.
 * @param {string} tagAttrStr
 */
function parseAttributes(tagAttrStr) {
  const props = {};
  const bindings = {};
  const regex = /([a-zA-Z0-9_-]+)(?:=(["'])(.*?)\2)?/g;
  let match;

  while ((match = regex.exec(tagAttrStr)) !== null) {
    const rawName = match[1];
    if (rawName === "component-from-global-scope" || rawName === "data-pid") continue;

    const propName = toCamelCase(rawName);
    const value = match[3] !== undefined ? match[3] : true;

    if (typeof value === "string") {
      const bindingMatch = /^\{\{([a-zA-Z0-9_.-]+)\}\}$/.exec(value.trim());
      if (bindingMatch) {
        bindings[propName] = {
          propName,
          stateKey: bindingMatch[1],
        };
        props[propName] = null;
        continue;
      }

      // Converte números e booleanos
      if (/^\d+$/.test(value)) {
        props[propName] = Number(value);
        continue;
      }
      if (value === "true") {
        props[propName] = true;
        continue;
      }
      if (value === "false") {
        props[propName] = false;
        continue;
      }
    }

    props[propName] = value;
  }

  return { props, bindings };
}

/**
 * Analisa fragmentos HTML do monólito e extrai os nós PrototypeNode.
 * @param {string} html
 * @param {string} [idPrefix="node"]
 */
function parseSemanticNodes(html, idPrefix = "node") {
  const nodes = [];
  let counter = 0;

  // 1. Busca tags <x-import component-from-global-scope="...">
  const xImportRegex = /<x-import\s+([^>]*?)>(?:<\/x-import>)?/gi;
  let match;

  while ((match = xImportRegex.exec(html)) !== null) {
    const attrStr = match[1];
    const compMatch = /component-from-global-scope=["']([^"']+)["']/i.exec(attrStr);
    if (!compMatch) continue;

    const globalName = compMatch[1];
    const componentId = resolveComponentId(globalName);
    const { props, bindings } = parseAttributes(attrStr);

    counter++;
    const node = {
      id: `${idPrefix}-${counter}`,
      componentId,
      componentVersion: "1.0.0",
      label: globalName.replace(/^DS\./, ""),
      props,
      bindings,
      events: {},
      slotTargets: {},
      children: [],
      rawMatch: match[0],
    };

    nodes.push(node);
  }

  return nodes;
}

module.exports = {
  COMPONENT_GLOBAL_MAP,
  resolveComponentId,
  parseAttributes,
  parseSemanticNodes,
  pascalToKebab,
  toCamelCase,
};

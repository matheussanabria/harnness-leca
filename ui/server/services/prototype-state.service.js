// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Obtém valor aninhado em um objeto via caminho separado por pontos.
 * @param {any} obj
 * @param {string} pathStr Ex: "patient.name" ou "prescriptions.0.drug"
 */
function getValueByPath(obj, pathStr) {
  if (!obj || typeof obj !== "object" || !pathStr) return undefined;
  const parts = pathStr.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Define valor aninhado em um objeto via caminho separado por pontos.
 * @param {any} obj
 * @param {string} pathStr
 * @param {any} value
 */
function setValueByPath(obj, pathStr, value) {
  if (!obj || typeof obj !== "object" || !pathStr) return obj;
  const parts = pathStr.split(".");
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!curr[part] || typeof curr[part] !== "object") {
      curr[part] = {};
    }
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = value;
  return obj;
}

/**
 * Combina globalState do protótipo com initialState da tela.
 * @param {any} proto
 * @param {string} screenId
 */
function resolveCombinedState(proto, screenId) {
  const global = proto?.globalState || {};
  const screenState = proto?.screens?.[screenId]?.initialState || {};
  return { ...global, ...screenState };
}

/**
 * Interpola variáveis {{key.path}} em uma string com base no estado.
 * @param {string} templateStr
 * @param {Record<string, any>} state
 */
function interpolateTemplate(templateStr, state) {
  if (typeof templateStr !== "string") return templateStr;
  return templateStr.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, keyPath) => {
    const val = getValueByPath(state, keyPath.trim());
    return val !== undefined && val !== null ? String(val) : match;
  });
}

/**
 * Hidrata recursivamente as props de um nó semântico com os bindings de estado.
 * @param {any} node
 * @param {Record<string, any>} state
 */
function hydrateNodePropsWithState(node, state) {
  if (!node) return node;
  const resolvedProps = { ...(node.props || {}) };

  // 1. Aplica bindings explícitos do nó
  if (node.bindings && typeof node.bindings === "object") {
    for (const [propName, binding] of Object.entries(node.bindings)) {
      if (binding?.stateKey) {
        const val = getValueByPath(state, binding.stateKey);
        if (val !== undefined) {
          resolvedProps[propName] = val;
        }
      }
    }
  }

  // 2. Interpola strings dentro das props existentes
  for (const [k, v] of Object.entries(resolvedProps)) {
    if (typeof v === "string") {
      resolvedProps[k] = interpolateTemplate(v, state);
    }
  }

  return {
    ...node,
    props: resolvedProps,
  };
}

/**
 * Carrega um dataset de mock em JSON do diretório do protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} datasetName
 */
function loadMockDataset(projectDir, protoId, datasetName) {
  const filePath = path.join(
    projectDir,
    "design",
    "prototypes",
    protoId,
    "data",
    `${datasetName}.json`
  );
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erro ao carregar dataset de mock '${datasetName}':`, err);
    return null;
  }
}

module.exports = {
  getValueByPath,
  setValueByPath,
  resolveCombinedState,
  interpolateTemplate,
  hydrateNodePropsWithState,
  loadMockDataset,
};

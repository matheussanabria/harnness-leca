// @ts-check
const { parseSemanticNodes } = require("./prototype-semantic-parser.service");

/**
 * Transforma tags proprietárias DataChef em elementos HTML semânticos anotados.
 * @param {string} rawHtml
 * @param {any[]} nodes Lista de PrototypeNodes gerada pelo parser semântico
 */
function cleanAndAnnotateHtml(rawHtml, nodes) {
  let cleanHtml = rawHtml;

  // 1. Substitui cada <x-import ...> por uma casca semântica anotada com data-node-id
  for (const node of nodes) {
    if (node.rawMatch) {
      const replacement = `<div id="${node.id}" data-node-id="${node.id}" data-component="${node.componentId}" class="ds-mount ds-${node.label.toLowerCase()}"></div>`;
      cleanHtml = cleanHtml.replace(node.rawMatch, replacement);
    }
  }

  // 2. Remove tags legadas do compilador DataChef que causam conflito
  cleanHtml = cleanHtml.replace(/<x-dc\b[^>]*>/gi, '<div class="dis-flow-container">');
  cleanHtml = cleanHtml.replace(/<\/x-dc>/gi, "</div>");
  cleanHtml = cleanHtml.replace(/<sc-(?:if|for|let)\b[^>]*>[\s\S]*?<\/sc-(?:if|for|let)>/gi, "");
  cleanHtml = cleanHtml.replace(/<script\b[^>]*support\.js[^>]*><\/script>/gi, "");

  return cleanHtml.trim();
}

/**
 * Decompõe um template ou fluxo em telas estruturadas independentes.
 * @param {string} rawHtml
 * @param {string} [flowName="dis-paciente"]
 */
function decomposeIntoScreens(rawHtml, flowName = "dis-paciente") {
  const nodes = parseSemanticNodes(rawHtml, "node");
  const nodesMap = {};
  for (const n of nodes) {
    const { rawMatch, ...cleanNode } = n;
    nodesMap[cleanNode.id] = cleanNode;
  }

  // Identifica nós da tela inicial e da tela de dispensação detalhada
  const homeNodeIds = [];
  const dispNodeIds = [];

  for (const node of nodes) {
    if (node.componentId.includes("patient-header") || node.componentId.includes("annotation-list") || node.componentId.includes("header")) {
      homeNodeIds.push(node.id);
    } else {
      dispNodeIds.push(node.id);
    }
  }

  const annotatedHtml = cleanAndAnnotateHtml(rawHtml, nodes);

  // Tela Home (Resumo do Paciente e Anotações Clínicas)
  const homeScreen = {
    id: "home",
    title: "Resumo do Paciente",
    route: "/",
    htmlFile: "screens/home.html",
    rootNodeId: "root-home",
    initialState: { activeTab: "resumo" },
    nodes: {
      "root-home": {
        id: "root-home",
        componentId: "layout.container",
        props: { className: "dis-screen-home" },
        children: homeNodeIds.length > 0 ? homeNodeIds : Object.keys(nodesMap),
        slotTargets: {},
        events: {},
        bindings: {},
      },
      ...nodesMap,
    },
    htmlContent: annotatedHtml,
  };

  return {
    screens: {
      home: homeScreen,
    },
    allNodes: nodesMap,
  };
}

module.exports = {
  cleanAndAnnotateHtml,
  decomposeIntoScreens,
};

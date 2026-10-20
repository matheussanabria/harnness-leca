// @ts-check

/**
 * Cria a estrutura base de uma definição de protótipo v2.0.0.
 * @param {object} meta
 * @param {string} meta.id
 * @param {string} meta.title
 * @param {string} [meta.designSystemId]
 * @param {string} [meta.defaultScreenId]
 * @param {string} [meta.description]
 */
function createPrototypeDefinition(meta) {
  const now = new Date().toISOString();
  return {
    metadata: {
      id: meta.id,
      schemaVersion: "2.0.0",
      title: meta.title,
      description: meta.description || "",
      designSystemId: meta.designSystemId || "procempa-dis",
      defaultScreenId: meta.defaultScreenId || "home",
      createdAt: now,
      updatedAt: now,
    },
    screens: {},
    globalState: {},
    assets: {
      css: [],
      js: [],
      fonts: [],
    },
  };
}

/**
 * Adiciona uma nova tela à definição do protótipo.
 * @param {any} proto
 * @param {object} screenData
 * @param {string} screenData.id
 * @param {string} screenData.title
 * @param {string} [screenData.route]
 * @param {string} [screenData.htmlFile]
 * @param {object} [screenData.initialState]
 */
function addScreen(proto, screenData) {
  const rootNodeId = `root-${screenData.id}`;
  const rootNode = {
    id: rootNodeId,
    componentId: "layout.container",
    props: { tag: "main", className: "screen-container" },
    children: [],
    slotTargets: {},
    events: {},
    bindings: {},
  };

  const screen = {
    id: screenData.id,
    title: screenData.title,
    route: screenData.route || `/${screenData.id}`,
    htmlFile: screenData.htmlFile || `screens/${screenData.id}.html`,
    rootNodeId,
    initialState: screenData.initialState || {},
    nodes: {
      [rootNodeId]: rootNode,
    },
  };

  proto.screens[screenData.id] = screen;
  proto.metadata.updatedAt = new Date().toISOString();
  return screen;
}

/**
 * Adiciona um nó filho à tela, indexando-o no mapa O(1).
 * @param {any} screen
 * @param {object} nodeData
 * @param {string} nodeData.id
 * @param {string} nodeData.componentId
 * @param {object} [nodeData.props]
 * @param {string} [parentId] ID do nó pai (se omitido, adiciona ao rootNodeId)
 * @param {string} [slotName] Nome do slot de destino no pai, se aplicável
 */
function addNode(screen, nodeData, parentId = null, slotName = null) {
  const targetParentId = parentId || screen.rootNodeId;
  const parentNode = screen.nodes[targetParentId];
  if (!parentNode) {
    throw new Error(`Nó pai '${targetParentId}' não encontrado na tela '${screen.id}'.`);
  }

  const newNode = {
    id: nodeData.id,
    componentId: nodeData.componentId,
    componentVersion: nodeData.componentVersion || "1.0.0",
    label: nodeData.label || "",
    props: nodeData.props || {},
    bindings: nodeData.bindings || {},
    events: nodeData.events || {},
    slotTargets: nodeData.slotTargets || {},
    children: nodeData.children || [],
  };

  screen.nodes[newNode.id] = newNode;

  if (slotName) {
    parentNode.slotTargets = parentNode.slotTargets || {};
    parentNode.slotTargets[slotName] = parentNode.slotTargets[slotName] || [];
    if (!parentNode.slotTargets[slotName].includes(newNode.id)) {
      parentNode.slotTargets[slotName].push(newNode.id);
    }
  } else {
    parentNode.children = parentNode.children || [];
    if (!parentNode.children.includes(newNode.id)) {
      parentNode.children.push(newNode.id);
    }
  }

  return newNode;
}

/**
 * Constrói a árvore hierárquica aninhada a partir do mapa O(1) de nós.
 * @param {string} rootNodeId
 * @param {Record<string, any>} nodesMap
 */
function buildTreeFromMap(rootNodeId, nodesMap) {
  const root = nodesMap[rootNodeId];
  if (!root) return null;

  function hydrate(node) {
    const copy = { ...node };
    if (Array.isArray(node.children)) {
      copy.children = node.children
        .map((childId) => nodesMap[childId])
        .filter(Boolean)
        .map(hydrate);
    }
    if (node.slotTargets && typeof node.slotTargets === "object") {
      copy.slotTargets = {};
      for (const [slot, childIds] of Object.entries(node.slotTargets)) {
        copy.slotTargets[slot] = (Array.isArray(childIds) ? childIds : [])
          .map((cid) => nodesMap[cid])
          .filter(Boolean)
          .map(hydrate);
      }
    }
    return copy;
  }

  return hydrate(root);
}

/**
 * Achatamento recursivo de uma árvore em um mapa O(1) de nós.
 * @param {any} rootNode
 */
function flattenTreeToMap(rootNode) {
  const nodesMap = {};

  function traverse(node) {
    if (!node || !node.id) return;
    const flatNode = {
      id: node.id,
      componentId: node.componentId,
      componentVersion: node.componentVersion || "1.0.0",
      label: node.label || "",
      props: node.props || {},
      bindings: node.bindings || {},
      events: node.events || {},
      slotTargets: {},
      children: [],
    };

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        flatNode.children.push(child.id);
        traverse(child);
      }
    }

    if (node.slotTargets && typeof node.slotTargets === "object") {
      for (const [slot, children] of Object.entries(node.slotTargets)) {
        flatNode.slotTargets[slot] = [];
        for (const child of children) {
          flatNode.slotTargets[slot].push(child.id);
          traverse(child);
        }
      }
    }

    nodesMap[node.id] = flatNode;
  }

  traverse(rootNode);
  return nodesMap;
}

/**
 * Resolve o destino de navegação para um evento de nó.
 * @param {any} proto
 * @param {any} node
 * @param {string} eventName
 */
function resolveNodeNavigation(proto, node, eventName = "click") {
  const action = node?.events?.[eventName];
  if (!action || action.type !== "navigate" || !action.target) {
    return null;
  }
  return proto.screens[action.target] || null;
}

/**
 * Aplica mutação não destrutiva nas propriedades de um nó semântico.
 * @param {any} proto
 * @param {string} screenId
 * @param {string} nodeId
 * @param {Record<string, any>} newProps
 */
function mutateNodeProps(proto, screenId, nodeId, newProps = {}) {
  const screen = proto.screens?.[screenId];
  if (!screen) {
    throw new Error(`Tela '${screenId}' não encontrada no protótipo.`);
  }
  const node = screen.nodes?.[nodeId];
  if (!node) {
    throw new Error(`Nó '${nodeId}' não encontrado na tela '${screenId}'.`);
  }

  node.props = {
    ...(node.props || {}),
    ...newProps,
  };
  proto.metadata.updatedAt = new Date().toISOString();
  return node;
}

module.exports = {
  createPrototypeDefinition,
  addScreen,
  addNode,
  mutateNodeProps,
  buildTreeFromMap,
  flattenTreeToMap,
  resolveNodeNavigation,
};


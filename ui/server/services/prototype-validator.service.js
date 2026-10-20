// @ts-check

/**
 * Validador estrito de integridade do formato PrototypeDefinition v2.0.0.
 * @param {any} proto
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePrototypeDefinition(proto) {
  const errors = [];

  if (!proto || typeof proto !== "object") {
    return { valid: false, errors: ["Definição de protótipo deve ser um objeto."] };
  }

  // 1. Validação de Metadata
  const meta = proto.metadata;
  if (!meta || typeof meta !== "object") {
    errors.push("Propriedade 'metadata' é obrigatória e deve ser um objeto.");
  } else {
    if (!meta.id || typeof meta.id !== "string") {
      errors.push("metadata.id é obrigatório e deve ser uma string.");
    }
    if (meta.schemaVersion !== "2.0.0") {
      errors.push(`metadata.schemaVersion deve ser estritamente '2.0.0' (encontrado: '${meta.schemaVersion}').`);
    }
    if (!meta.title || typeof meta.title !== "string") {
      errors.push("metadata.title é obrigatório e deve ser uma string.");
    }
    if (!meta.defaultScreenId || typeof meta.defaultScreenId !== "string") {
      errors.push("metadata.defaultScreenId é obrigatório.");
    }
  }

  // 2. Validação de Screens
  const screens = proto.screens;
  if (!screens || typeof screens !== "object" || Object.keys(screens).length === 0) {
    errors.push("Propriedade 'screens' é obrigatória e deve conter ao menos uma tela.");
    return { valid: errors.length === 0, errors };
  }

  // Valida se defaultScreenId existe
  if (meta && meta.defaultScreenId && !screens[meta.defaultScreenId]) {
    errors.push(`Tela padrão 'defaultScreenId: ${meta.defaultScreenId}' não existe no mapa de telas.`);
  }

  // 3. Validação individual de cada tela
  for (const [screenId, screen] of Object.entries(screens)) {
    if (!screen || typeof screen !== "object") {
      errors.push(`Tela '${screenId}' deve ser um objeto válido.`);
      continue;
    }

    if (screen.id !== screenId) {
      errors.push(`Inconsistência de ID: chave '${screenId}' difere de screen.id '${screen.id}'.`);
    }

    if (!screen.title || typeof screen.title !== "string") {
      errors.push(`Tela '${screenId}' deve ter um título legível.`);
    }

    if (!screen.rootNodeId || typeof screen.rootNodeId !== "string") {
      errors.push(`Tela '${screenId}' deve definir um 'rootNodeId'.`);
      continue;
    }

    const nodes = screen.nodes;
    if (!nodes || typeof nodes !== "object") {
      errors.push(`Tela '${screenId}' deve possuir o mapa 'nodes'.`);
      continue;
    }

    if (!nodes[screen.rootNodeId]) {
      errors.push(`Nó raiz '${screen.rootNodeId}' não existe em screen.nodes da tela '${screenId}'.`);
    }

    // 4. Validação de cada nó da tela
    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!node || typeof node !== "object") {
        errors.push(`Nó '${nodeId}' da tela '${screenId}' deve ser um objeto.`);
        continue;
      }

      if (node.id !== nodeId) {
        errors.push(`Inconsistência de ID de nó na tela '${screenId}': chave '${nodeId}' != node.id '${node.id}'.`);
      }

      if (!node.componentId || typeof node.componentId !== "string") {
        errors.push(`Nó '${nodeId}' na tela '${screenId}' não possui 'componentId' válido.`);
      }

      // Valida filhos lineares
      if (node.children) {
        if (!Array.isArray(node.children)) {
          errors.push(`'children' do nó '${nodeId}' deve ser um array de IDs.`);
        } else {
          for (const childId of node.children) {
            if (!nodes[childId]) {
              errors.push(`Filho '${childId}' referenciado pelo nó '${nodeId}' não existe na tela '${screenId}'.`);
            }
          }
        }
      }

      // Valida slots
      if (node.slotTargets) {
        if (typeof node.slotTargets !== "object" || Array.isArray(node.slotTargets)) {
          errors.push(`'slotTargets' do nó '${nodeId}' deve ser um mapa de slots para arrays de IDs.`);
        } else {
          for (const [slot, childIds] of Object.entries(node.slotTargets)) {
            if (!Array.isArray(childIds)) {
              errors.push(`Slot '${slot}' do nó '${nodeId}' deve ser um array de IDs.`);
            } else {
              for (const cid of childIds) {
                if (!nodes[cid]) {
                  errors.push(`Filho '${cid}' alocado no slot '${slot}' do nó '${nodeId}' não existe na tela '${screenId}'.`);
                }
              }
            }
          }
        }
      }

      // Valida integridade referencial de eventos de navegação
      if (node.events && typeof node.events === "object") {
        for (const [eventName, action] of Object.entries(node.events)) {
          if (action?.type === "navigate" && action.target) {
            if (!screens[action.target]) {
              errors.push(
                `Evento '${eventName}' do nó '${nodeId}' navega para tela inexistente '${action.target}'.`
              );
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validatePrototypeDefinition,
};

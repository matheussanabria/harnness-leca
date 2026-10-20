// @ts-check
const { buildTreeFromMap } = require("./prototype-schema.service");
const { resolveHtmlTag } = require("./prototype-codegen-vanilla.service");

function toPascalCase(str) {
  if (!str) return "Screen";
  return str
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Compila nós semânticos para JSX compatível com React 18+.
 * @param {any} node
 * @param {object} [options]
 * @returns {string}
 */
function generateReactJsxNode(node, options = {}) {
  if (!node) return "";

  const tag = resolveHtmlTag(node.componentId, node.props?.tag);
  const classes = [node.props?.className, node.props?.variant ? `is-${node.props.variant}` : ""].filter(Boolean).join(" ");

  const attrs = [];
  if (classes) attrs.push(`className="${classes}"`);
  if (options.includeNodeId !== false && node.id) attrs.push(`data-node-id="${node.id}"`);

  // Props estáticas ou bindings de estado
  if (node.bindings && typeof node.bindings === "object") {
    for (const [propName, expr] of Object.entries(node.bindings)) {
      const key = typeof expr === "object" && expr ? (expr.stateKey || expr.path || propName) : expr;
      attrs.push(`${propName}={state?.${key}}`);
    }
  }

  if (node.props?.disabled) attrs.push("disabled={true}");
  if (node.props?.title) attrs.push(`title="${node.props.title}"`);
  if (node.props?.type && tag === "button") attrs.push(`type="${node.props.type}"`);

  // Eventos React
  if (node.events?.click) {
    if (node.events.click.type === "navigate") {
      attrs.push(`onClick={() => handleNavigate('${node.events.click.target}')}`);
    } else {
      attrs.push(`onClick={() => handleAction('${node.id}')}`);
    }
  }

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  const isSelfClosing = ["img", "input", "br", "hr"].includes(tag);
  if (isSelfClosing) return `<${tag}${attrStr} />`;

  let inner = "";
  if (node.props?.label) inner += `{${JSON.stringify(node.props.label)}}`;
  if (node.props?.text) inner += `{${JSON.stringify(node.props.text)}}`;

  // Filhos
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      inner += generateReactJsxNode(child, options);
    }
  }

  // Slots nomeados
  if (node.slotTargets && typeof node.slotTargets === "object") {
    for (const [slotName, slotChildren] of Object.entries(node.slotTargets)) {
      inner += `<div className="slot-${slotName}" data-slot="${slotName}">`;
      for (const child of slotChildren) {
        inner += generateReactJsxNode(child, options);
      }
      inner += `</div>`;
    }
  }

  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

/**
 * Gera o componente funcional React 18 completo (TSX).
 * @param {any} screen
 * @param {string} componentName
 * @param {string} jsxBody
 */
function generateReactTsxComponent(screen, componentName, jsxBody) {
  const initialState = JSON.stringify(screen.initialState || {}, null, 2);

  return `import React, { useState, useCallback } from 'react';
import './${componentName}.css';

export interface ${componentName}Props {
  onNavigate?: (screenId: string) => void;
  onAction?: (nodeId: string) => void;
}

/**
 * Componente de tela gerado para React 18+ a partir da árvore semântica do protótipo.
 */
export function ${componentName}({ onNavigate, onAction }: ${componentName}Props) {
  const [state, setState] = useState<Record<string, any>>(${initialState});

  const handleNavigate = useCallback((targetScreen: string) => {
    if (onNavigate) onNavigate(targetScreen);
    else console.info('Navegando para:', targetScreen);
  }, [onNavigate]);

  const handleAction = useCallback((nodeId: string) => {
    if (onAction) onAction(nodeId);
    else console.info('Ação disparada no nó:', nodeId);
  }, [onAction]);

  return (
    ${jsxBody}
  );
}

export default ${componentName};
`;
}

/**
 * Compila uma tela do proto.json para o pacote React 18 (TSX, CSS).
 * @param {any} screen
 * @param {any} proto
 * @param {object} [options]
 */
function generateReactScreen(screen, proto, options = {}) {
  if (!screen || !screen.nodes) {
    throw new Error("Definição de tela inválida ou sem mapa de nós.");
  }

  const baseName = toPascalCase(screen.id);
  const componentName = `${baseName}Screen`;

  const rootId = screen.rootNodeId || Object.keys(screen.nodes)[0];
  const tree = buildTreeFromMap(rootId, screen.nodes);

  const jsxBody = generateReactJsxNode(tree, options);
  const tsx = generateReactTsxComponent(screen, componentName, jsxBody);
  const css = `/* Estilos do componente de tela ${componentName} */\n.${screen.id}-container {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n}\n`;

  return {
    screenId: screen.id,
    componentName,
    tsx,
    css,
    framework: "react18",
  };
}

module.exports = {
  toPascalCase,
  generateReactJsxNode,
  generateReactTsxComponent,
  generateReactScreen,
};

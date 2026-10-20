// @ts-check
const { buildTreeFromMap } = require("./prototype-schema.service");

/**
 * Escapa strings para uso seguro em atributos HTML.
 * @param {string} str
 */
function escapeAttr(str) {
  if (typeof str !== "string") return "";
  return str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Mapeia IDs de componentes do Design System para tags HTML padrão.
 * @param {string} componentId
 * @returns {string}
 */
function resolveHtmlTag(componentId, explicitTag = null) {
  if (explicitTag) return explicitTag;
  if (!componentId) return "div";
  if (componentId.includes("button")) return "button";
  if (componentId.includes("icon")) return "i";
  if (componentId.includes("header")) return "header";
  if (componentId.includes("nav")) return "nav";
  if (componentId.includes("card")) return "section";
  if (componentId.includes("container")) return "main";
  return "div";
}

/**
 * Gera código HTML para um nó semântico e seus filhos recursivos.
 * @param {any} node Nó hierárquico com children preenchidos
 * @param {object} [options]
 * @returns {string}
 */
function generateVanillaNode(node, options = {}) {
  if (!node) return "";

  const tag = resolveHtmlTag(node.componentId, node.props?.tag);
  const classes = [node.props?.className, node.props?.variant ? `is-${node.props.variant}` : ""].filter(Boolean).join(" ");
  
  const attrs = [];
  if (classes) attrs.push(`class="${escapeAttr(classes)}"`);
  if (options.includeNodeId !== false && node.id) attrs.push(`data-node-id="${escapeAttr(node.id)}"`);

  // Atributos declarativos comuns
  if (node.props?.title) attrs.push(`title="${escapeAttr(node.props.title)}"`);
  if (node.props?.disabled) attrs.push("disabled");
  if (node.props?.type && tag === "button") attrs.push(`type="${escapeAttr(node.props.type)}"`);
  if (node.props?.iconClass) attrs.push(`class="${escapeAttr(node.props.iconClass)}"`);

  // Navegação declarativa
  if (node.events?.click?.type === "navigate" && node.events?.click?.target) {
    attrs.push(`data-action="goto:${escapeAttr(node.events.click.target)}"`);
  }

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  const isSelfClosing = ["img", "input", "br", "hr"].includes(tag);
  if (isSelfClosing) return `<${tag}${attrStr} />`;

  let inner = "";
  if (node.props?.label) inner += escapeAttr(node.props.label);
  if (node.props?.text) inner += escapeAttr(node.props.text);

  // Renderiza filhos normais
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      inner += generateVanillaNode(child, options);
    }
  }

  // Renderiza slots nomeados
  if (node.slotTargets && typeof node.slotTargets === "object") {
    for (const [slotName, slotChildren] of Object.entries(node.slotTargets)) {
      inner += `<div class="slot-${escapeAttr(slotName)}" data-slot="${escapeAttr(slotName)}">`;
      for (const child of slotChildren) {
        inner += generateVanillaNode(child, options);
      }
      inner += `</div>`;
    }
  }

  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

/**
 * Gera os scripts ES Module para os comportamentos interativos da tela.
 * @param {any} screen
 * @returns {string}
 */
function generateVanillaScript(screen) {
  const actions = [];
  for (const node of Object.values(screen.nodes || {})) {
    if (node.events?.click?.type === "navigate") {
      actions.push(`  // Ação de navegação para ${node.id} -> ${node.events.click.target}`);
    }
  }

  return `// @ts-check
/**
 * Script de interatividade da tela ${screen.id || "home"} (Vanilla ES Module).
 */
export function setupScreen(container = document) {
  container.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const action = el.getAttribute("data-action") || "";
      if (action.startsWith("goto:")) {
        e.preventDefault();
        const targetScreen = action.replace(/^goto:/, "").trim();
        window.dispatchEvent(new CustomEvent("harness:navigate", { detail: { screen: targetScreen } }));
      }
    });
  });
}
`;
}

/**
 * Gera pacote completo Vanilla (HTML, CSS, JS) para uma tela estruturada.
 * @param {any} screen Tela do proto.json com mapa de nós
 * @param {any} proto Protótipo pai
 * @param {object} [options]
 */
function generateVanillaScreen(screen, proto, options = {}) {
  if (!screen || !screen.nodes) {
    throw new Error("Definição de tela inválida ou sem mapa de nós.");
  }

  const rootId = screen.rootNodeId || Object.keys(screen.nodes)[0];
  const tree = buildTreeFromMap(rootId, screen.nodes);
  const html = generateVanillaNode(tree, options);
  const js = generateVanillaScript(screen);
  const css = `/* Estilos canônicos da tela ${screen.id} */\n.screen-container {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n}\n`;

  return {
    screenId: screen.id,
    html,
    css,
    js,
    framework: "vanilla",
  };
}

module.exports = {
  resolveHtmlTag,
  generateVanillaNode,
  generateVanillaScript,
  generateVanillaScreen,
};

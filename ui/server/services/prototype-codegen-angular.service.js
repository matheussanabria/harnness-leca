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

function toKebabCase(str) {
  if (!str) return "screen";
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Compila nós semânticos para templates Angular 18 com bindings e eventos.
 * @param {any} node
 * @param {object} [options]
 * @returns {string}
 */
function generateAngularTemplateNode(node, options = {}) {
  if (!node) return "";

  const tag = resolveHtmlTag(node.componentId, node.props?.tag);
  const classes = [node.props?.className, node.props?.variant ? `is-${node.props.variant}` : ""].filter(Boolean).join(" ");

  const attrs = [];
  if (classes) attrs.push(`class="${classes}"`);
  if (options.includeNodeId !== false && node.id) attrs.push(`data-node-id="${node.id}"`);

  // Props estáticas ou dinâmicas
  if (node.bindings && typeof node.bindings === "object") {
    for (const [propName, expr] of Object.entries(node.bindings)) {
      const key = typeof expr === "object" && expr ? (expr.stateKey || expr.path || propName) : expr;
      attrs.push(`[${propName}]="state().${key}"`);
    }
  }

  if (node.props?.disabled) attrs.push("[disabled]=\"true\"");
  if (node.props?.title) attrs.push(`title="${node.props.title}"`);
  if (node.props?.type && tag === "button") attrs.push(`type="${node.props.type}"`);

  // Eventos Angular 18
  if (node.events?.click) {
    if (node.events.click.type === "navigate") {
      attrs.push(`(click)="onNavigate('${node.events.click.target}')"`);
    } else {
      attrs.push(`(click)="onAction('${node.id}')"`);
    }
  }

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  const isSelfClosing = ["img", "input", "br", "hr"].includes(tag);
  if (isSelfClosing) return `<${tag}${attrStr} />`;

  let inner = "";
  if (node.props?.label) inner += node.props.label;
  if (node.props?.text) inner += node.props.text;

  // Filhos
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      inner += generateAngularTemplateNode(child, options);
    }
  }

  // Slots nomeados via ng-content select ou tags estruturadas
  if (node.slotTargets && typeof node.slotTargets === "object") {
    for (const [slotName, slotChildren] of Object.entries(node.slotTargets)) {
      inner += `<div slot="${slotName}">`;
      for (const child of slotChildren) {
        inner += generateAngularTemplateNode(child, options);
      }
      inner += `</div>`;
    }
  }

  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

/**
 * Gera a classe TypeScript Angular 18 com Signals e Standalone Component.
 * @param {any} screen
 * @param {string} componentName
 * @param {string} selector
 */
function generateAngularClass(screen, componentName, selector) {
  const initialState = JSON.stringify(screen.initialState || {}, null, 2);

  return `import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './${toKebabCase(screen.id)}.component.html',
  styleUrls: ['./${toKebabCase(screen.id)}.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${componentName}Component {
  // Estado reativo da tela com Angular Signals
  readonly state = signal<Record<string, any>>(${initialState});

  onNavigate(targetScreen: string): void {
    console.info('Navegando para tela:', targetScreen);
  }

  onAction(nodeId: string): void {
    console.info('Ação disparada no nó:', nodeId);
  }
}
`;
}

/**
 * Compila uma tela do proto.json para o pacote Angular 18 (TS, HTML, CSS).
 * @param {any} screen
 * @param {any} proto
 * @param {object} [options]
 */
function generateAngularScreen(screen, proto, options = {}) {
  if (!screen || !screen.nodes) {
    throw new Error("Definição de tela inválida ou sem mapa de nós.");
  }

  const baseName = toPascalCase(screen.id);
  const componentName = `${baseName}Screen`;
  const selector = `app-${toKebabCase(screen.id)}`;

  const rootId = screen.rootNodeId || Object.keys(screen.nodes)[0];
  const tree = buildTreeFromMap(rootId, screen.nodes);

  const html = generateAngularTemplateNode(tree, options);
  const ts = generateAngularClass(screen, componentName, selector);
  const css = `:host {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n}\n`;

  return {
    screenId: screen.id,
    componentName,
    selector,
    ts,
    html,
    css,
    framework: "angular18",
  };
}

module.exports = {
  toPascalCase,
  toKebabCase,
  generateAngularTemplateNode,
  generateAngularClass,
  generateAngularScreen,
};

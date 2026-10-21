// @ts-check
import { esc } from "../shared/dom.js";
import { numOf, parseRotate, parseTranslate, sizeMode } from "./prototype-props-model.js";
import { renderStyleSections } from "./prototype-props-style-view.js";
import { renderTypeSection } from "./prototype-props-type-view.js";

/**
 * HTML do painel Posição e Layout (estilo Figma). Cada campo tem data-px="<propriedade>"
 * ou data-px-act="<ação>"; o comportamento fica em prototype-props-panel.js.
 */
const field = (label, prop, value, extra = "") =>
  `<label class="pp-field" title="${esc(prop)}"><span class="pp-lbl">${label}</span><input class="pp-input" type="text" data-px="${prop}" value="${esc(value)}" autocomplete="off" ${extra}></label>`;

const select = (prop, value, options) =>
  `<select class="pp-select" data-px="${prop}">${options.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select>`;

const iconBtn = (act, icon, title, on = false) =>
  `<button type="button" class="pp-icon${on ? " is-on" : ""}" data-px-act="${act}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;

const MODES = [["fixed", "Fixo"], ["hug", "Ajustar"], ["fill", "Preencher"]];

function section(title, body) {
  return `<section class="pp-section"><h4 class="pp-title">${title}</h4>${body}</section>`;
}

/** @param {{ computed?: Record<string,string>, size?: {w:number,h:number}, parent?: {display?:string,direction?:string}, ownRule?: string, cls?: string }} node */
export function renderPropsHtml(node) {
  const c = node.computed || {};
  const size = node.size || { w: 0, h: 0 };
  const [tx, ty] = parseTranslate(c.translate);
  const isFlex = /flex/.test(c.display || "");
  const column = (c["flex-direction"] || "").startsWith("column");
  const parentFlex = /flex/.test(node.parent?.display || "");

  const position = section("Posição", `
    <div class="pp-label">Alinhamento</div>
    <div class="pp-row pp-align">
      ${iconBtn("left", "fa-align-left", "Alinhar à esquerda")}${iconBtn("center", "fa-align-center", "Centralizar na horizontal")}${iconBtn("right", "fa-align-right", "Alinhar à direita")}
      <span class="pp-sep"></span>
      ${iconBtn("top", "fa-arrows-up-to-line", "Alinhar ao topo")}${iconBtn("middle", "fa-arrows-up-down", "Centralizar na vertical")}${iconBtn("bottom", "fa-arrows-down-to-line", "Alinhar à base")}
    </div>
    <div class="pp-label">Deslocamento</div>
    <div class="pp-row">${field("X", "translate-x", tx)}${field("Y", "translate-y", ty)}</div>
    <div class="pp-label">Rotação</div>
    <div class="pp-row">${field('<i class="fa-solid fa-rotate-right"></i>', "rotate", parseRotate(c.rotate))}</div>`);

  const dims = section("Dimensões", `
    <div class="pp-row pp-dim">${field("L", "width", numOf(c.width) || String(size.w))}${select("width-mode", sizeMode(c.width), MODES)}</div>
    <div class="pp-row pp-dim">${field("A", "height", numOf(c.height) || String(size.h))}${select("height-mode", sizeMode(c.height), MODES)}</div>
    <label class="pp-check"><input type="checkbox" data-px-act="clip"${c.overflow === "hidden" ? " checked" : ""}> Cortar conteúdo</label>`);

  const layout = section("Layout", `
    <div class="pp-label">Exibição</div>
    <div class="pp-row">${select("display", c.display, [["block", "Bloco"], ["flex", "Flex"], ["inline-flex", "Flex em linha"], ["grid", "Grade"], ["inline-block", "Bloco em linha"], ["none", "Oculto"]])}</div>
    ${isFlex ? `
    <div class="pp-label">Direção</div>
    <div class="pp-row">${iconBtn("dir-row", "fa-arrow-right", "Horizontal", !column)}${iconBtn("dir-column", "fa-arrow-down", "Vertical", column)}
      <label class="pp-check"><input type="checkbox" data-px-act="wrap"${c["flex-wrap"] === "wrap" ? " checked" : ""}> Quebrar linha</label></div>
    <div class="pp-row">${select("justify-content", c["justify-content"], [["normal", "Principal"], ["flex-start", "Início"], ["center", "Centro"], ["flex-end", "Fim"], ["space-between", "Espaço entre"], ["space-around", "Espaço ao redor"]])}
      ${select("align-items", c["align-items"], [["normal", "Cruzado"], ["flex-start", "Início"], ["center", "Centro"], ["flex-end", "Fim"], ["stretch", "Esticar"], ["baseline", "Linha de base"]])}</div>` : ""}
    <div class="pp-label">Espaçamento (gap)</div>
    <div class="pp-row">${field('<i class="fa-solid fa-arrows-left-right-to-line"></i>', "gap", numOf(c.gap))}</div>
    <div class="pp-label">Padding (T D B E)</div>
    <div class="pp-row pp-quad">${["top", "right", "bottom", "left"].map((s) => field("", `padding-${s}`, numOf(c[`padding-${s}`]))).join("")}</div>
    <div class="pp-label">Margem (T D B E)</div>
    <div class="pp-row pp-quad">${["top", "right", "bottom", "left"].map((s) => field("", `margin-${s}`, numOf(c[`margin-${s}`]))).join("")}</div>
    ${parentFlex ? `<div class="pp-label">No pai flex</div><div class="pp-row">${select("align-self", c["align-self"], [["auto", "Alinhar: auto"], ["flex-start", "Início"], ["center", "Centro"], ["flex-end", "Fim"], ["stretch", "Esticar"]])}
      <label class="pp-check"><input type="checkbox" data-px-act="grow"${Number(c["flex-grow"]) > 0 ? " checked" : ""}> Preencher espaço</label></div>` : ""}`);

  return `<div class="pp-root">${position}${dims}${layout}${renderTypeSection(node)}${renderStyleSections(node)}<div class="pp-code" data-pp-code></div></div>`;
}

/** Bloco de código da classe do elemento (somente leitura, com copiar). */
export function renderCodeHtml(cls, ruleLines) {
  if (!ruleLines) return `<div class="pp-label">Classe gerada</div><div class="pp-muted">Nenhum estilo gravado ainda. Edite um campo acima e a classe <code>.px-…</code> aparece aqui e em <code>styles/proto.css</code>.</div>`;
  return `<div class="pp-head"><span class="pp-label">Classe <code>${esc(cls)}</code> em styles/proto.css</span><button type="button" class="pp-copy" data-px-act="copy-rule"><i class="fa-solid fa-copy"></i> Copiar</button></div><pre class="pp-pre">${esc(ruleLines)}</pre>`;
}

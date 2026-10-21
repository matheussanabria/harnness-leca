// @ts-check
import { colorFieldValue, declsOf, numOf } from "./prototype-props-model.js";
import { alignOf, fontOptions, lineHeightOf, WEIGHTS, weightValue } from "./prototype-props-type-model.js";
import { colorRow, field, section, select } from "./prototype-props-style-view.js";

/** Seção Tipografia do painel de propriedades (fonte, tamanho, peso, linha, espaçamento, alinhamento, cor). */

const alignBtn = (key, icon, title, on) =>
  `<button type="button" class="pp-icon${on ? " is-on" : ""}" data-px-act="ta-${key}" title="${title}"><i class="fa-solid ${icon}"></i></button>`;

/** @param {{ computed?: Record<string,string>, ownRule?: string, tokens?: { colors: Array<{name:string,value:string}>, fonts?: Array<{name:string,value:string}> } }} node */
export function renderTypeSection(node) {
  const c = node.computed || {};
  const own = declsOf(node.ownRule);
  const align = alignOf(c["text-align"]);
  const options = fontOptions(c["font-family"], node.tokens?.fonts || []);
  const decoration = (c["text-decoration-line"] || "none").split(" ")[0];

  return section("Tipografia", `
    <div class="pp-row">${select("font-family", options[0][0], options)}</div>
    <div class="pp-row">${field("T", "font-size", numOf(c["font-size"]))}${select("font-weight", weightValue(c["font-weight"]), WEIGHTS)}</div>
    <div class="pp-row">${field('<i class="fa-solid fa-text-height"></i>', "line-height", lineHeightOf(c["line-height"], c["font-size"]))}${field('<i class="fa-solid fa-text-width"></i>', "letter-spacing", numOf(c["letter-spacing"]))}</div>
    <div class="pp-row">${alignBtn("left", "fa-align-left", "Texto à esquerda", align === "left")}${alignBtn("center", "fa-align-center", "Texto centralizado", align === "center")}${alignBtn("right", "fa-align-right", "Texto à direita", align === "right")}${alignBtn("justify", "fa-align-justify", "Texto justificado", align === "justify")}</div>
    <div class="pp-row">${select("text-transform", c["text-transform"] || "none", [["none", "Aa original"], ["uppercase", "AA maiúsculas"], ["lowercase", "aa minúsculas"], ["capitalize", "Aa título"]])}${select("text-decoration", decoration, [["none", "Sem linha"], ["underline", "Sublinhado"], ["line-through", "Riscado"]])}</div>
    <div class="pp-label">Cor do texto</div>
    ${colorRow("color", colorFieldValue("color", own, c.color), c.color, node.tokens?.colors || [], "color-none")}`);
}

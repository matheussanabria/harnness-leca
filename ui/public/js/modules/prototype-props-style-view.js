// @ts-check
import { esc } from "../shared/dom.js";
import { blurOf, colorFieldValue, declsOf, numOf, parseOpacity, swatchHex, uniformRadius } from "./prototype-props-model.js";

/** Seções Aparência, Preenchimento, Contorno e Efeitos do painel de propriedades. */

export const field = (label, prop, value, extra = "") =>
  `<label class="pp-field" title="${esc(prop)}"><span class="pp-lbl">${label}</span><input class="pp-input" type="text" data-px="${prop}" value="${esc(value)}" autocomplete="off" ${extra}></label>`;

export const section = (title, body) => `<section class="pp-section"><h4 class="pp-title">${title}</h4>${body}</section>`;

export const select = (prop, value, options) =>
  `<select class="pp-select" data-px="${prop}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

/** Linha de cor: seletor nativo, campo (hex ou var) e grade de tokens do DS. */
export function colorRow(prop, value, computed, tokens, removeAct) {
  const swatches = tokens.length
    ? `<details class="pp-tokens"><summary>Tokens do DS (${tokens.length})</summary><div class="pp-swatches">${tokens.map((t) =>
      `<button type="button" class="pp-swatch" style="background:${esc(t.value)}" data-px-token="${esc(t.name)}" data-px-prop="${prop}" title="${esc(t.name)}: ${esc(t.value)}"></button>`).join("")}</div></details>`
    : "";
  return `<div class="pp-row"><input type="color" class="pp-color" data-px-color="${prop}" value="${swatchHex(value, computed)}" title="Escolher cor">
    ${field("", prop, value, 'placeholder="#RRGGBB ou var(--token)"')}
    <button type="button" class="pp-icon" data-px-act="${removeAct}" title="Remover"><i class="fa-solid fa-minus"></i></button></div>${swatches}`;
}

/** @param {{ computed?: Record<string,string>, ownRule?: string, tokens?: { colors: Array<{name:string,value:string}>, shadows: Array<{name:string,value:string}> } }} node */
export function renderStyleSections(node) {
  const c = node.computed || {};
  const own = declsOf(node.ownRule);
  const colors = node.tokens?.colors || [];
  const shadows = node.tokens?.shadows || [];
  const radius = uniformRadius(c);
  const hasStroke = c["border-top-style"] && c["border-top-style"] !== "none" && numOf(c["border-top-width"]) !== "" && numOf(c["border-top-width"]) !== "0";
  const shadowValue = own["box-shadow"] || (c["box-shadow"] && c["box-shadow"] !== "none" ? "custom" : "none");
  const shadowOptions = [["none", "Nenhuma"], ...shadows.map((s) => [`var(${s.name})`, s.name.replace(/^--/, "")]), ["custom", "Personalizada"]];
  const shadowKnown = shadowOptions.some(([v]) => v === shadowValue);

  const appearance = section("Aparência", `
    <div class="pp-row">${field('<i class="fa-solid fa-droplet"></i>', "opacity", parseOpacity(c.opacity))}${field('<i class="fa-solid fa-vector-square"></i>', "border-radius", radius ?? "")}</div>
    <details class="pp-tokens"><summary>Cantos individuais</summary><div class="pp-row pp-quad">${["top-left", "top-right", "bottom-right", "bottom-left"].map((k) => field("", `border-${k}-radius`, numOf(c[`border-${k}-radius`]))).join("")}</div></details>`);

  const fill = section("Preenchimento", colorRow("background-color", colorFieldValue("background-color", own, c["background-color"]), c["background-color"], colors, "fill-none"));

  const stroke = section("Contorno", `${colorRow("border-color", hasStroke ? colorFieldValue("border-color", own, c["border-top-color"]) : "", c["border-top-color"], colors, "stroke-none")}
    <div class="pp-row">${field("L", "border-width", hasStroke ? numOf(c["border-top-width"]) : "")}${select("border-style", c["border-top-style"] || "none", [["none", "Nenhum"], ["solid", "Sólido"], ["dashed", "Tracejado"], ["dotted", "Pontilhado"]])}</div>`);

  const effects = section("Efeitos", `
    <div class="pp-label">Sombra</div>
    <div class="pp-row">${select("box-shadow", shadowKnown ? shadowValue : "custom", shadowOptions)}</div>
    <div class="pp-row">${field("", "box-shadow", own["box-shadow"] && !/^var\(/.test(own["box-shadow"]) ? own["box-shadow"] : "", 'placeholder="0 4px 8px rgba(0,0,0,.2)" data-px-text="1"')}</div>
    <div class="pp-label">Desfoque da camada</div>
    <div class="pp-row">${field('<i class="fa-solid fa-droplet-slash"></i>', "blur", blurOf(c.filter))}</div>`);

  return appearance + fill + stroke + effects;
}

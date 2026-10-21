// @ts-check
/**
 * Regras puras do painel Posição e Layout (sem DOM): converte o que o usuário digita
 * em declarações CSS e lê o que o navegador calculou.
 */

/** "12" vira "12px"; texto com unidade, var() ou palavra-chave passa como veio. */
export function toCss(raw) {
  const v = String(raw ?? "").trim();
  if (v === "") return "";
  return /^-?\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}

/** "12.5px" vira "12.5"; qualquer outra coisa vira "". */
export function numOf(css) {
  const m = /^(-?\d+(\.\d+)?)px$/.exec(String(css ?? "").trim());
  return m ? String(Math.round(Number(m[1]) * 10) / 10) : "";
}

/** Modo de dimensionamento estilo Figma: fixo, ajustar ao conteúdo (hug) ou preencher (fill). */
export function sizeMode(value) {
  const v = String(value ?? "").trim();
  if (v === "100%") return "fill";
  if (v === "fit-content" || v === "auto" || v === "max-content") return "hug";
  return "fixed";
}

/**
 * @param {"width"|"height"} dim
 * @param {"fixed"|"hug"|"fill"} mode
 * @param {string} currentPx tamanho atual medido, usado ao voltar para "fixo"
 */
export function sizePatch(dim, mode, currentPx) {
  if (mode === "fill") return { [dim]: "100%" };
  if (mode === "hug") return { [dim]: dim === "height" ? "auto" : "fit-content" };
  return { [dim]: toCss(currentPx) };
}

/** Lê "10px 4px" (propriedade translate) em [x, y]. */
export function parseTranslate(value) {
  const parts = String(value ?? "").trim().split(/\s+/).filter((p) => p && p !== "none");
  return [numOf(parts[0] || "0px") || "0", numOf(parts[1] || "0px") || "0"];
}

/** X/Y deslocam o elemento sem tirá-lo do fluxo (propriedade translate). */
export function translatePatch(x, y) {
  const nx = toCss(x || "0");
  const ny = toCss(y || "0");
  return { translate: nx === "0px" && ny === "0px" ? "" : `${nx} ${ny}` };
}

export function rotatePatch(deg) {
  const v = String(deg ?? "").trim();
  if (v === "" || Number(v) === 0) return { rotate: "" };
  return { rotate: /deg$/.test(v) ? v : `${v}deg` };
}

export function parseRotate(value) {
  const m = /^(-?\d+(\.\d+)?)deg$/.exec(String(value ?? "").trim());
  return m ? String(Math.round(Number(m[1]) * 10) / 10) : "0";
}

const FLEX_END = { start: "flex-start", center: "center", end: "flex-end" };

/**
 * Alinhamento em relação ao pai. Retorna null quando o pai não permite (bloco comum na vertical).
 * @param {"left"|"center"|"right"|"top"|"middle"|"bottom"} kind
 * @param {{ display?: string, direction?: string }} parent
 */
export function alignPatch(kind, parent = {}) {
  const flex = /flex/.test(parent.display || "");
  const column = flex && (parent.direction || "").startsWith("column");
  const row = flex && !column;
  const side = { left: "start", center: "center", right: "end", top: "start", middle: "center", bottom: "end" }[kind];
  if (kind === "left" || kind === "center" || kind === "right") {
    if (column) return { "align-self": FLEX_END[side] };
    return { "margin-left": side === "start" ? "0" : "auto", "margin-right": side === "end" ? "0" : "auto" };
  }
  if (row) return { "align-self": FLEX_END[side] };
  if (column) return { "margin-top": side === "start" ? "0" : "auto", "margin-bottom": side === "end" ? "0" : "auto" };
  return null;
}

/** ".px-p-1 { a: b; c: d; }" em linhas legíveis para o bloco de código. */
export function ruleToLines(rule) {
  const m = /^([^{]+)\{([^}]*)\}/.exec(String(rule ?? "").trim());
  if (!m) return "";
  const decls = m[2].split(";").map((d) => d.trim()).filter(Boolean);
  return `${m[1].trim()} {\n${decls.map((d) => `  ${d};`).join("\n")}\n}`;
}

/** Soma delta ao número do campo (setas do teclado; Shift = 10). Texto com unidade vira px. */
export function stepValue(raw, delta) {
  const m = /^(-?\d+(\.\d+)?)(px)?$/.exec(String(raw ?? "").trim() || "0");
  if (!m) return null;
  return String(Math.round((Number(m[1]) + delta) * 10) / 10);
}

/** Declarações de uma regra ".cls { a: b; }" em objeto. */
export function declsOf(rule) {
  const m = /\{([^}]*)\}/.exec(String(rule ?? ""));
  if (!m) return {};
  return Object.fromEntries(m[1].split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
  }));
}

/** rgb()/rgba()/#hex em { hex: "#rrggbb", alpha: 0..1 }; transparente ou ilegível vira null. */
export function parseColor(css) {
  const v = String(css ?? "").trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { hex: `#${h.slice(0, 6)}`, alpha: h.length === 8 ? Math.round((parseInt(h.slice(6), 16) / 255) * 100) / 100 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return null;
  const hex = [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0")).join("");
  let alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  alpha = Math.round(alpha * 100) / 100;
  return alpha === 0 ? null : { hex: `#${hex}`, alpha };
}

/** Valor para mostrar no campo de cor: o token (var) gravado na regra do elemento, ou a cor calculada em hex. */
export function colorFieldValue(prop, own, computed) {
  const gravado = (own || {})[prop];
  if (gravado) return gravado;
  const c = parseColor(computed);
  if (!c) return "";
  return c.alpha < 1 ? `rgba(${parseInt(c.hex.slice(1, 3), 16)}, ${parseInt(c.hex.slice(3, 5), 16)}, ${parseInt(c.hex.slice(5, 7), 16)}, ${c.alpha})` : c.hex;
}

/** Cor para o seletor nativo (sempre #rrggbb). */
export function swatchHex(value, computed) {
  const direct = parseColor(value);
  if (direct) return direct.hex;
  return parseColor(computed)?.hex || "#000000";
}

/** Opacidade em % (0-100) para o campo e de volta para CSS. */
export function parseOpacity(css) {
  const n = Number.parseFloat(String(css ?? "1"));
  return Number.isFinite(n) ? String(Math.round(n * 100)) : "100";
}

export function opacityPatch(pct) {
  const raw = String(pct ?? "").trim().replace("%", "");
  if (raw === "") return { opacity: "" };
  const n = Math.max(0, Math.min(100, Number(raw)));
  if (!Number.isFinite(n)) return null;
  return { opacity: n === 100 ? "" : String(Math.round(n) / 100) };
}

/** Quatro cantos iguais viram um único valor; senão devolve null (mostrar cantos individuais). */
export function uniformRadius(c) {
  const v = ["top-left", "top-right", "bottom-right", "bottom-left"].map((k) => numOf(c[`border-${k}-radius`]) || "0");
  return v.every((x) => x === v[0]) ? v[0] : null;
}

/** Raio único: limpa os cantos individuais para a regra não ficar contraditória. */
export function radiusPatch(value) {
  const corners = { "border-top-left-radius": "", "border-top-right-radius": "", "border-bottom-right-radius": "", "border-bottom-left-radius": "" };
  const v = toCss(value);
  return { ...corners, "border-radius": v === "0px" ? "" : v };
}

/** Contorno: ao dar largura a um elemento sem borda, a borda vira sólida. */
export function strokePatch(prop, value, computed = {}) {
  if (prop === "border-style") return { "border-style": value === "none" ? "" : value };
  if (prop === "border-color") return { "border-color": value };
  const width = toCss(value);
  const hasStyle = computed["border-top-style"] && computed["border-top-style"] !== "none";
  const patch = { "border-width": width };
  if (width && width !== "0px" && !hasStyle) patch["border-style"] = "solid";
  return patch;
}

export const STROKE_CLEAR = { "border-width": "", "border-style": "", "border-color": "" };

export function blurOf(filter) {
  const m = /blur\((-?\d+(\.\d+)?)px\)/.exec(String(filter ?? ""));
  return m ? m[1] : "";
}

export function blurPatch(value) {
  const n = String(value ?? "").trim();
  if (n === "" || Number(n) === 0) return { filter: "" };
  return Number.isFinite(Number(n)) ? { filter: `blur(${n}px)` } : null;
}

/** Sombra do select: vazia/none remove; "custom" não altera nada. */
export function shadowPatch(value) {
  if (value === "custom") return null;
  return { "box-shadow": value === "none" ? "" : value };
}

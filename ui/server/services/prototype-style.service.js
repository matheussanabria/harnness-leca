// @ts-check
/**
 * Edição de estilos do painel Posição e Layout: o elemento ganha uma classe própria
 * (`px-<pid>`) e a regra vai para styles/proto.css, sem estilo inline no HTML.
 * Funções puras; a gravação em disco fica em prototype-editor.service.js.
 */
const { findNodeRangeByPid } = require("./prototype-structural.service");

const STYLE_PROPS = new Set([
  "width", "height", "min-width", "max-width", "min-height", "max-height", "aspect-ratio", "box-sizing",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "display", "flex-direction", "flex-wrap", "justify-content", "align-items", "align-content", "align-self", "justify-self",
  "gap", "row-gap", "column-gap", "flex", "flex-grow", "flex-shrink", "flex-basis", "order", "grid-template-columns",
  "position", "top", "right", "bottom", "left", "z-index", "overflow", "overflow-x", "overflow-y", "translate", "rotate",
  // Aparência, preenchimento, contorno e efeitos
  "opacity", "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "background-color", "border-width", "border-style", "border-color", "box-shadow", "filter", "mix-blend-mode",
  // Tipografia
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align",
  "text-transform", "text-decoration", "color",
]);

const SAFE_VALUE = /^[#\w\s%.,()\-+/*'"]*$/;

/**
 * Valida e normaliza o mapa de estilos. Valor vazio significa "remover a propriedade".
 * @param {Record<string, string>} styles
 * @returns {Array<[string, string]>}
 */
function sanitizeStyles(styles) {
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) throw new Error("Estilos inválidos.");
  const entries = Object.entries(styles);
  if (!entries.length) throw new Error("Nenhum estilo informado.");
  return entries.map(([prop, raw]) => {
    const name = String(prop).trim().toLowerCase();
    if (!STYLE_PROPS.has(name)) throw new Error(`Propriedade '${name}' não permitida no painel.`);
    const value = String(raw ?? "").trim();
    if (value.length > 120 || !SAFE_VALUE.test(value) || /url\(|expression|@import/i.test(value)) {
      throw new Error(`Valor inválido para '${name}'.`);
    }
    return [name, value];
  });
}

/** @param {string} pid */
function classFor(pid) {
  const clean = String(pid).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) throw new Error("Elemento sem identificador.");
  return `px-${clean}`;
}

/** Acrescenta a classe à tag de abertura, sem duplicar. */
function addClassToOpenTag(openTag, cls) {
  const m = /\sclass=(["'])([^"']*)\1/i.exec(openTag);
  if (m) {
    if (m[2].split(/\s+/).includes(cls)) return openTag;
    return openTag.replace(m[0], ` class=${m[1]}${`${m[2]} ${cls}`.trim()}${m[1]}`);
  }
  return openTag.replace(/\s*(\/?)>$/, ` class="${cls}"$1>`);
}

/** Tira a classe da tag; remove o atributo class se ficar vazio. */
function removeClassFromOpenTag(openTag, cls) {
  const m = /\sclass=(["'])([^"']*)\1/i.exec(openTag);
  if (!m || !m[2].split(/\s+/).includes(cls)) return openTag;
  const rest = m[2].split(/\s+/).filter((c) => c && c !== cls).join(" ");
  return openTag.replace(m[0], rest ? ` class=${m[1]}${rest}${m[1]}` : "");
}

/** Remove da tag as propriedades dadas do atributo style (para a classe valer de verdade). */
function stripInlineProps(openTag, props) {
  const m = /\sstyle=(["'])([^"']*)\1/i.exec(openTag);
  if (!m) return openTag;
  const kept = m[2].split(";").map((s) => s.trim()).filter((decl) => decl && !props.includes(decl.split(":")[0].trim().toLowerCase()));
  return openTag.replace(m[0], kept.length ? ` style=${m[1]}${kept.join("; ")}${m[1]}` : "");
}

const ruleRegex = (cls) => new RegExp(`(^|\\n)\\.${cls.replace(/[-]/g, "\\-")}\\s*\\{([^}]*)\\}\\n?`);

/** Lê as declarações atuais de uma regra do CSS. */
function readRule(css, cls) {
  const m = ruleRegex(cls).exec(css);
  if (!m) return {};
  return Object.fromEntries(m[2].split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
  }));
}

/** Cria, atualiza ou remove a regra `.cls` no CSS. */
function upsertRule(css, cls, entries) {
  const decls = readRule(css, cls);
  for (const [prop, value] of entries) {
    if (value === "") delete decls[prop];
    else decls[prop] = value;
  }
  const without = css.replace(ruleRegex(cls), (all, lead) => lead);
  const body = Object.entries(decls);
  if (!body.length) return without.replace(/\n{3,}/g, "\n\n");
  const rule = `.${cls} {\n${body.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}\n`;
  return `${without.replace(/\s*$/, "")}\n\n${rule}`.replace(/^\n+/, "");
}

/**
 * @param {string} html
 * @param {string} css
 * @param {string} pid
 * @param {Record<string, string>} styles
 * @returns {{ html: string, css: string, cls: string, rule: string }}
 */
function applyStyleOp(html, css, pid, styles) {
  const entries = sanitizeStyles(styles);
  const range = findNodeRangeByPid(html, pid);
  if (!range) throw new Error(`Elemento com data-pid="${pid}" não encontrado nesta tela.`);
  const cls = classFor(pid);
  let openTag = stripInlineProps(range.openTag, entries.map(([p]) => p));
  const nextCss = upsertRule(css || "", cls, entries);
  const hasRule = Object.keys(readRule(nextCss, cls)).length > 0;
  openTag = hasRule ? addClassToOpenTag(openTag, cls) : removeClassFromOpenTag(openTag, cls);
  const nextHtml = html.slice(0, range.startIndex) + openTag + range.innerContent + range.closeTag + html.slice(range.endIndex);
  const rule = hasRule ? (ruleRegex(cls).exec(nextCss) || [])[0]?.trim() || "" : "";
  return { html: nextHtml, css: nextCss, cls, rule };
}

module.exports = { STYLE_PROPS, sanitizeStyles, classFor, addClassToOpenTag, stripInlineProps, readRule, upsertRule, applyStyleOp };

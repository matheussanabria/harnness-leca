// @ts-check
/** Realce de sintaxe leve (HTML, CSS, JS/TS/JSX) com as mesmas classes tk-* dos snippets da vitrine do DS. */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KW = "import|export|from|as|const|let|var|function|return|if|else|for|while|new|class|extends|implements|type|interface|async|await|try|catch|finally|throw|of|in|typeof|void|null|undefined|true|false|this|default|switch|case|break|continue|readonly|private|public|protected|static|get|set|constructor|declare|enum|keyof";
const RE_HTML = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w.:-]*)|(\/?>)|(\s[:@[\]()*#\w.-]+)(?==)|("[^"]*"|'[^']*')|(\{\{[\s\S]*?\}\})/g;
const RE_JS = new RegExp("(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|(`(?:\\\\.|[^`\\\\])*`)|('(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\")|(<\\/?[A-Za-z][\\w.]*(?=[\\s>\\/]))|(\\b(?:" + KW + ")\\b)|(\\b\\d+(?:\\.\\d+)?\\b)|(@[A-Z]\\w*)", "g");
// Propriedade = nome inteiro (com hífens) logo depois de "{", ";" ou início da linha; número leva a unidade junto.
const RE_CSS = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(@[\w-]+)|(?<=(?:^|[{;])\s*)(-{0,2}[a-zA-Z][\w-]*)(?=\s*:(?!:))|(#[0-9a-fA-F]{3,8}(?![\w-])|(?<![\w-])-?\d+(?:\.\d+)?(?:px|rem|em|%|ms|s|fr|vh|vw)?(?![\w-]))/gm;

const HTML_CLS = ["", "tk-c", "tk-t", "tk-t", "tk-a", "tk-s", "tk-n"];
const JS_CLS = ["", "tk-c", "", "tk-s", "tk-t", "tk-k", "tk-n", "tk-a"];
const CSS_CLS = ["", "tk-c", "tk-s", "tk-k", "tk-a", "tk-n"];

/** Percorre o código aplicando uma classe por grupo capturado; o resto sai escapado. */
function run(code, source, classes, special) {
  const re = new RegExp(source, "g");
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    let i = 1;
    while (i < m.length && m[i] === undefined) i++;
    out += special?.(i, m[0]) ?? `<span class="${classes[i] || ""}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return out + esc(code.slice(last));
}

const html = (c) => run(c, RE_HTML.source, HTML_CLS);
const css = (c) => run(c, RE_CSS.source, CSS_CLS);
const js = (c) => run(c, RE_JS.source, JS_CLS, (i, t) => {
  if (i !== 2) return null;
  const inner = t.slice(1, -1);
  return `<span class="tk-s">\`</span>${/[<{]/.test(inner) ? html(inner) : `<span class="tk-s">${esc(inner)}</span>`}<span class="tk-s">\`</span>`;
});

/**
 * @param {string} code
 * @param {"html"|"css"|"js"|"plain"} lang
 * @returns {string} HTML seguro (todo o texto do código é escapado)
 */
export function highlight(code, lang) {
  const text = String(code ?? "");
  if (lang === "html") return html(text);
  if (lang === "css") return css(text);
  if (lang === "plain") return esc(text);
  return js(text);
}

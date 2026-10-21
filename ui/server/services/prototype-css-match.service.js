// @ts-check
/**
 * Acha, nos CSS do projeto, as regras que atingem as classes de um elemento
 * (para a aba CSS do painel mostrar o estilo real de componentes do DS, e não só a classe px-*).
 */

const MAX_BLOCK = 3000;
const MAX_TOTAL = 12000;

/** Separa o CSS em blocos de primeiro nível (regras e at-rules), sem comentários. */
function splitBlocks(css) {
  const clean = String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { out.push(clean.slice(start, i + 1).trim()); start = i + 1; }
      if (depth < 0) depth = 0;
    }
  }
  return out;
}

/** @param {string[]} classes */
function classMatcher(classes) {
  const parts = classes.filter(Boolean).map((c) => c.replace(/[^\w-]/g, "")).filter(Boolean);
  if (!parts.length) return null;
  return new RegExp(`\\.(?:${parts.join("|")})(?![\\w-])`);
}

/**
 * @param {string} css
 * @param {string[]} classes
 * @returns {string[]} blocos que contêm alguma das classes (regras comuns pelo seletor; at-rules inteiras)
 */
function matchingBlocks(css, classes) {
  const re = classMatcher(classes);
  if (!re) return [];
  return splitBlocks(css).filter((block) => {
    const head = block.startsWith("@") ? block : block.slice(0, Math.max(0, block.indexOf("{")));
    return re.test(head);
  }).map((b) => (b.length > MAX_BLOCK ? `${b.slice(0, MAX_BLOCK)}\n/* ... */` : b));
}

/**
 * @param {Array<{ label: string, file: string }>} sources arquivos CSS a varrer
 * @param {string[]} classes
 * @param {{ fs: any }} deps
 * @returns {string} texto pronto para exibir ("" quando nada atinge o elemento)
 */
function matchedCssText(sources, classes, deps) {
  const chunks = [];
  let total = 0;
  for (const { label, file } of sources) {
    let css = "";
    try { css = deps.fs.readFileSync(file, "utf8"); } catch { continue; }
    const blocks = matchingBlocks(css, classes);
    if (!blocks.length) continue;
    let text = `/* ${label} */\n${blocks.join("\n\n")}`;
    if (total + text.length > MAX_TOTAL) text = `${text.slice(0, Math.max(0, MAX_TOTAL - total))}\n/* ... */`;
    chunks.push(text);
    total += text.length;
    if (total >= MAX_TOTAL) break;
  }
  return chunks.join("\n\n");
}

module.exports = { splitBlocks, matchingBlocks, matchedCssText };

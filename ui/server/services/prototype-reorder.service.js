// @ts-check
/**
 * Reordena um elemento no HTML da tela (arrastar no canvas ou na árvore de camadas):
 * move o nó para antes, depois ou dentro de outro nó, identificados por data-pid.
 */
const { findNodeRangeByPid } = require("./prototype-structural.service");

const POSITIONS = new Set(["before", "after", "inside"]);

/** Indentação (espaços/tabs) da linha onde o índice cai. */
function indentAt(html, index) {
  const lineStart = html.lastIndexOf("\n", index - 1) + 1;
  const m = /^[ \t]*/.exec(html.slice(lineStart, index));
  return m ? m[0] : "";
}

/**
 * @param {string} html
 * @param {string} pid
 * @param {string} targetPid
 * @param {"before"|"after"|"inside"} position
 * @returns {string}
 */
function reorderHtml(html, pid, targetPid, position) {
  if (!POSITIONS.has(position)) throw new Error(`Posição inválida: ${position}`);
  if (!pid || !targetPid || pid === targetPid) throw new Error("Origem e destino precisam ser elementos diferentes.");
  const node = findNodeRangeByPid(html, pid);
  const target = findNodeRangeByPid(html, targetPid);
  if (!node) throw new Error(`Elemento com data-pid="${pid}" não encontrado.`);
  if (!target) throw new Error(`Destino com data-pid="${targetPid}" não encontrado.`);
  if (target.startIndex >= node.startIndex && target.endIndex <= node.endIndex) throw new Error("Não é possível mover um elemento para dentro dele mesmo.");
  if (position === "inside" && target.isSelfClosing) throw new Error("Este elemento não aceita filhos.");

  // Remove o nó junto com a linha que ele ocupava sozinho.
  let start = node.startIndex;
  let end = node.endIndex;
  const lineStart = html.lastIndexOf("\n", start - 1) + 1;
  if (/^[ \t]*$/.test(html.slice(lineStart, start)) && /^[ \t]*\n/.test(html.slice(end))) {
    start = lineStart;
    end += /^[ \t]*\n/.exec(html.slice(end))[0].length;
  }
  const rest = html.slice(0, start) + html.slice(end);
  const moved = node.fullMatch;
  const t = findNodeRangeByPid(rest, targetPid);
  if (!t) throw new Error("Falha ao localizar o destino após remover o elemento.");
  const indent = indentAt(rest, t.startIndex);

  if (position === "before") return `${rest.slice(0, t.startIndex)}${moved}\n${indent}${rest.slice(t.startIndex)}`;
  if (position === "after") return `${rest.slice(0, t.endIndex)}\n${indent}${moved}${rest.slice(t.endIndex)}`;
  const inner = t.innerContent.replace(/\s+$/, "");
  const next = `${t.openTag}${inner}\n${indent}  ${moved}\n${indent}${t.closeTag}`;
  return rest.slice(0, t.startIndex) + next + rest.slice(t.endIndex);
}

module.exports = { reorderHtml, POSITIONS };

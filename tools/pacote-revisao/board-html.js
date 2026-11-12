// @ts-check
// Monta o quadro-historias.html (arquivo unico) a partir dos dados coletados e do template.
const fs = require("fs");
const path = require("path");

/** JSON seguro para dentro de <script type="application/json">. */
function safeJson(value) {
  const BS = String.fromCharCode(92);
  const LS = new RegExp(String.fromCharCode(0x2028), "g");
  const PS = new RegExp(String.fromCharCode(0x2029), "g");
  return JSON.stringify(value)
    .replace(/</g, () => BS + "u003c")
    .replace(LS, () => BS + "u2028")
    .replace(PS, () => BS + "u2029");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * @param {{ board: { geradoEm: string, stories: any[] }, config: any, snapshotEm?: string }} p
 * @returns {string} HTML completo
 */
function renderBoardHtml({ board, config, snapshotEm }) {
  const template = fs.readFileSync(path.join(__dirname, "board-template.html"), "utf8");
  const data = {
    geradoEm: board.geradoEm,
    snapshotEm: snapshotEm || board.geradoEm,
    stories: board.stories,
    config: { colunas: config.colunas, statusParaColuna: config.statusParaColuna, epicos: config.epicos },
  };
  return template.replace(/__TITULO__/g, () => esc(config.titulo)).replace("__DATA__", () => safeJson(data));
}

module.exports = { renderBoardHtml, safeJson };

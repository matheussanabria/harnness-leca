// @ts-check
// Recorta de uma tela de protótipo do DIS apenas a area de conteudo (main.dis-shell__content),
// sem cabecalho, cabecalho do paciente e menu lateral. O recorte fica dentro de um .dis-shell para os estilos do DS valerem.

const OPEN_RE = /<main\b[^>]*\bdis-shell__content\b[^>]*>/i;

/** Estilo extra do recorte: a secao ocupa a largura toda, sem a margem que o menu lateral deixava. */
const SECTION_CSS = "body{margin:0}.dis-shell--section{min-height:0}.dis-shell--section .dis-shell__content{padding:12px 16px 24px}";

/**
 * @param {string} html HTML da tela do protótipo
 * @returns {string} HTML so com a secao; sem a area de conteudo devolve a tela inteira
 */
function extractContentSection(html) {
  const open = OPEN_RE.exec(html);
  if (!open) return html;
  const tags = /<\/?main\b[^>]*>/gi;
  tags.lastIndex = open.index;
  let depth = 0;
  let end = -1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0][1] === "/" ? -1 : 1;
    if (depth === 0) {
      end = match.index + match[0].length;
      break;
    }
  }
  if (end < 0) return html;
  // Os scripts da tela (acordeao, busca, paginacao) ficam fora do <main>; sem eles a secao nao funciona.
  const outside = html.slice(0, open.index) + html.slice(end);
  const scripts = (outside.match(/<script\b[\s\S]*?<\/script>/gi) || []).join("\n");
  return `<div class="ds dis dis-shell dis-shell--section" data-component="dis.section-only">${html.slice(open.index, end)}</div>\n${scripts}`;
}

module.exports = { extractContentSection, SECTION_CSS };

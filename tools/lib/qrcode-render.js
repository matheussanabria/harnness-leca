// @ts-check
// Geração da matriz final e saídas ASCII/SVG.
const { selectVersion, encodeData } = require("./qrcode-encode");
const { createMatrix, placeDataAndMask } = require("./qrcode-matrix");

/**
 * Gera a matriz 2D de módulos (0 ou 1) de um QR Code
 * @param {string} text
 * @returns {number[][]}
 */
function generateQrMatrix(text) {
  const spec = selectVersion(Buffer.byteLength(text, "utf8"));
  const data = encodeData(text, spec);
  const mat = createMatrix(spec);
  placeDataAndMask(mat, data, 0);
  return mat.m;
}

/**
 * Gera uma representação em texto ASCII para o terminal usando caracteres de bloco UTF-8
 * @param {string} text
 * @param {number} [margin=1]
 * @returns {string}
 */
function generateAsciiQr(text, margin = 1) {
  try {
    const matrix = generateQrMatrix(text);
    const size = matrix.length;
    const border = "  ".repeat(size + margin * 2);
    const lines = [];

    for (let i = 0; i < margin; i++) lines.push(border);

    // Usa ▀ (U+2580) e ▄ (U+2584) para renderizar 2 linhas da matriz por linha de caractere
    for (let r = 0; r < size; r += 2) {
      let line = " ".repeat(margin * 2);
      for (let c = 0; c < size; c++) {
        const top = matrix[r][c] === 1;
        const bottom = r + 1 < size ? matrix[r + 1][c] === 1 : false;
        if (top && bottom) line += "█";
        else if (top && !bottom) line += "▀";
        else if (!top && bottom) line += "▄";
        else line += " ";
      }
      line += " ".repeat(margin * 2);
      lines.push(line);
    }

    for (let i = 0; i < margin; i++) lines.push(border);
    return lines.join("\n");
  } catch (err) {
    return `[QR Code não disponível: ${err.message}]`;
  }
}

/**
 * Gera um elemento SVG autônomo do QR Code para exibição no navegador
 * @param {string} text
 * @param {number} [moduleSize=6]
 * @param {number} [margin=2]
 * @returns {string}
 */
function generateSvgQr(text, moduleSize = 6, margin = 2) {
  try {
    const matrix = generateQrMatrix(text);
    const size = matrix.length;
    const totalSize = (size + margin * 2) * moduleSize;
    let paths = "";

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          paths += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" style="border-radius:12px;background:#ffffff;padding:8px">
  <path d="${paths}" fill="#0f172a" />
</svg>`;
  } catch (err) {
    return `<div style="color:red">Erro ao gerar QR Code: ${err.message}</div>`;
  }
}

module.exports = { generateQrMatrix, generateAsciiQr, generateSvgQr };

// @ts-check
// Fachada de qrcode: reexporta a API pública dos módulos (qrcode-gf, qrcode-encode, qrcode-matrix, qrcode-render).
const { generateQrMatrix, generateAsciiQr, generateSvgQr } = require("./qrcode-render");

module.exports = { generateQrMatrix, generateAsciiQr, generateSvgQr };

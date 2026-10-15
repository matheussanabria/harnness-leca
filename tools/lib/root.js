// @ts-check
// Raiz do harness (pasta que tem projects/ e global/). HARNESS_ROOT permite apontar para outra pasta,
// usado pelos testes para não tocar nos projetos reais.
const path = require("path");

const ROOT = process.env.HARNESS_ROOT
  ? path.resolve(process.env.HARNESS_ROOT)
  : path.resolve(__dirname, "..", "..");

module.exports = { ROOT };

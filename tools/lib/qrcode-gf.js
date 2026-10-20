// @ts-check
// Aritmética de Galois e códigos de correção de erro (Reed-Solomon).
const { GF256, LOG_GF256 } = require("./qrcode-store");

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF256[LOG_GF256[x] + LOG_GF256[y]];
}

function polyMul(p1, p2) {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function getGeneratorPoly(numEC) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < numEC; i++) {
    g = polyMul(g, new Uint8Array([1, GF256[i]]));
  }
  return g;
}

function calculateEC(data, numEC) {
  const g = getGeneratorPoly(numEC);
  const msg = new Uint8Array(data.length + numEC);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = msg[i];
    if (factor !== 0) {
      for (let j = 0; j < g.length; j++) {
        msg[i + j] ^= gfMul(g[j], factor);
      }
    }
  }
  return msg.slice(data.length);
}

module.exports = { gfMul, polyMul, getGeneratorPoly, calculateEC };

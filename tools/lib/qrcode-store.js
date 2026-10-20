// @ts-check
// Estado/constantes compartilhados de qrcode.

const GF256 = new Uint8Array(512);
const LOG_GF256 = new Uint8Array(256);
(function initGalois() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF256[i] = val;
    GF256[i + 255] = val;
    LOG_GF256[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
})();

module.exports = { GF256, LOG_GF256 };

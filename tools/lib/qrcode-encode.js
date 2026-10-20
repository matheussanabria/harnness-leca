// @ts-check
// Especificações de versão e codificação dos dados.
const { calculateEC } = require("./qrcode-gf");

// Tabela de capacidade e blocos para ECC nível M (Medium - padrão excelente para scanners)
const VERSION_SPECS = [
  null,
  { version: 1, size: 21, dataBytes: 16, numEC: 10, blocks: 1, align: [] },
  { version: 2, size: 25, dataBytes: 28, numEC: 16, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, dataBytes: 44, numEC: 26, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, dataBytes: 64, numEC: 18, blocks: 2, align: [6, 26] },
  { version: 5, size: 37, dataBytes: 86, numEC: 24, blocks: 2, align: [6, 30] },
  { version: 6, size: 41, dataBytes: 108, numEC: 16, blocks: 4, align: [6, 34] },
  { version: 7, size: 45, dataBytes: 124, numEC: 18, blocks: 4, align: [6, 22, 38] },
  { version: 8, size: 49, dataBytes: 154, numEC: 22, blocks: 4, align: [6, 24, 42] },
  { version: 9, size: 53, dataBytes: 182, numEC: 22, blocks: 5, align: [6, 26, 46] },
  { version: 10, size: 57, dataBytes: 216, numEC: 26, blocks: 5, align: [6, 28, 50] },
];

function selectVersion(byteCount) {
  for (let v = 1; v < VERSION_SPECS.length; v++) {
    const spec = VERSION_SPECS[v];
    // 4 bits modo + 8/16 bits comprimento
    const charCountBits = spec.version < 10 ? 8 : 16;
    const overhead = Math.ceil((4 + charCountBits) / 8);
    if (byteCount + overhead <= spec.dataBytes) return spec;
  }
  throw new Error(`Texto muito longo para QR Code (máximo suportado ~200 bytes)`);
}

function encodeData(text, spec) {
  const utf8 = Buffer.from(text, "utf8");
  const bits = [];
  const addBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Modo Byte = 0100
  addBits(4, 4);
  const charBits = spec.version < 10 ? 8 : 16;
  addBits(utf8.length, charBits);
  for (const b of utf8) addBits(b, 8);

  // Terminador
  const maxBits = spec.dataBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Alinha em byte
  while (bits.length % 8 !== 0) bits.push(0);

  // Bytes de preenchimento (pad bytes: 236 e 17)
  const pad = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    addBits(pad[padIdx++ % 2], 8);
  }

  // Converte bits em bytes
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    bytes.push(b);
  }

  // Divisão em blocos e cálculo de Error Correction
  const numBlocks = spec.blocks;
  const totalDataBytes = spec.dataBytes;
  const numECPerBlock = spec.numEC;
  const baseBlockLen = Math.floor(totalDataBytes / numBlocks);
  const extraBlocks = totalDataBytes % numBlocks;

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = baseBlockLen + (i >= numBlocks - extraBlocks ? 1 : 0);
    const blkData = new Uint8Array(bytes.slice(offset, offset + len));
    offset += len;
    dataBlocks.push(blkData);
    ecBlocks.push(calculateEC(blkData, numECPerBlock));
  }

  // Interleave dos blocos de dados
  const finalInterleaved = [];
  const maxDataBlockLen = baseBlockLen + (extraBlocks > 0 ? 1 : 0);
  for (let j = 0; j < maxDataBlockLen; j++) {
    for (let i = 0; i < numBlocks; i++) {
      if (j < dataBlocks[i].length) finalInterleaved.push(dataBlocks[i][j]);
    }
  }
  // Interleave dos blocos EC
  for (let j = 0; j < numECPerBlock; j++) {
    for (let i = 0; i < numBlocks; i++) {
      finalInterleaved.push(ecBlocks[i][j]);
    }
  }

  return finalInterleaved;
}

module.exports = { VERSION_SPECS, selectVersion, encodeData };

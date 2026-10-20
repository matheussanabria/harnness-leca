// @ts-check
// Construção da matriz, posicionamento e máscara.

function createMatrix(spec) {
  const size = spec.size;
  const m = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r, c, val) => {
    m[r][c] = val;
    reserved[r][c] = true;
  };

  // Finder patterns
  const drawFinder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r, nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(nr, nc, isBlack ? 1 : 0);
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (!reserved[6][i]) setModule(6, i, val);
    if (!reserved[i][6]) setModule(i, 6, val);
  }

  // Dark module
  setModule(size - 8, 8, 1);

  // Alignment patterns
  if (spec.align && spec.align.length > 0) {
    const coords = spec.align;
    for (const r of coords) {
      for (const c of coords) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isBlack ? 1 : 0);
          }
        }
      }
    }
  }

  // Reserva bits de formato (ao redor dos finders)
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) { m[8][i] = 0; reserved[8][i] = true; }
    if (!reserved[i][8]) { m[i][8] = 0; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) { m[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true; }
    if (!reserved[size - 1 - i][8]) { m[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true; }
  }

  return { m, reserved, size };
}

function placeDataAndMask(mat, dataBytes, maskPattern = 0) {
  const { m, reserved, size } = mat;
  const bitStream = [];
  for (const b of dataBytes) {
    for (let i = 7; i >= 0; i--) bitStream.push((b >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Pula timing vertical
    const cols = [right, right - 1];
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of cols) {
        if (!reserved[r][c]) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
          // Máscara 0: (row + col) % 2 === 0
          const mask = ((r + c) % 2 === 0) ? 1 : 0;
          m[r][c] = bit ^ mask;
        }
      }
    }
    upward = !upward;
  }

  // Grava informações de formato (ECC = M (00), Mask = 0 (000) => formato 00000 com BCH = 101010000010010)
  // Mask 0 com ECC M: bits de formato pré-calculados com XOR mask 0x5412 = 0x5412 ^ 0x0000 = 0x5412
  // Formato: 101010000010010 (15 bits)
  const FORMAT_BITS = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const f = FORMAT_BITS;

  // Horizontal top-left & bottom-left
  for (let i = 0; i < 6; i++) m[8][i] = f[i];
  m[8][7] = f[6];
  m[8][8] = f[7];
  m[7][8] = f[8];
  for (let i = 9; i < 15; i++) m[14 - i][8] = f[i];

  // Restante
  for (let i = 0; i < 8; i++) m[size - 1 - i][8] = f[i];
  for (let i = 8; i < 15; i++) m[8][size - 15 + i] = f[i];
}

module.exports = { createMatrix, placeDataAndMask };

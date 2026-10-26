// @ts-check
// Algoritmo de similaridade e deduplicação de itens de memória (EP-13.04).
// Sem dependência de embeddings ou modelos externos: baseado em trigramas e normalização canônica.
const { normalize } = require("./item");

/**
 * Extrai conjunto de trigramas de um texto normalizado.
 * @param {string} text
 * @returns {Set<string>}
 */
function getTrigrams(text) {
  const norm = `  ${normalize(text)} `;
  const trigrams = new Set();
  for (let i = 0; i < norm.length - 2; i++) {
    trigrams.add(norm.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Calcula a similaridade de Dice / Sørensen entre dois textos usando trigramas.
 * Varia entre 0 (totalmente diferente) e 1.0 (idêntico).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function similarity(a, b) {
  const normA = normalize(a);
  const normB = normalize(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const triA = getTrigrams(normA);
  const triB = getTrigrams(normB);

  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }

  return (2 * intersection) / (triA.size + triB.size);
}

/**
 * Verifica se um texto é considerado similar a outro pelo limiar padrão de 0.8.
 * @param {string} a
 * @param {string} b
 * @param {number} [threshold]
 * @returns {boolean}
 */
function isSimilar(a, b, threshold = 0.8) {
  return similarity(a, b) >= threshold;
}

module.exports = {
  getTrigrams,
  similarity,
  isSimilar,
};

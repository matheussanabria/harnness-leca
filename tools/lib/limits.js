// @ts-check
// Limites compartilhados pelos importadores.
module.exports = {
  MAX_IO: 1500, // caracteres por entrada/resultado de ferramenta no .md gerado
  MAX_FILE: 200 * 1024 * 1024, // transcrições maiores que isso são ignoradas (evita estourar a memória)
};

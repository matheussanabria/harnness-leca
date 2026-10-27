// @ts-check
// Coletor de memórias nativas do Gemini CLI / Antigravity (EP-13.08).
// Lê, somente leitura:
//   Bullets da seção "## Gemini Added Memories" em ~/.gemini/GEMINI.md
const fs = require("fs");
const path = require("path");

const SECTION_HEADER = /^##\s+Gemini\s+Added\s+Memories/i;

/**
 * Extrai bullets sob a seção ## Gemini Added Memories de um texto markdown.
 * @param {string} text
 * @returns {string[]}
 */
function extractGeminiMemories(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const items = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (SECTION_HEADER.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      // Se encontrar outro heading de nível 1 ou 2, encerra a seção
      if (/^#{1,2}\s+/.test(trimmed)) {
        break;
      }
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const bullet = trimmed.replace(/^[-*]\s+/, "").trim();
        if (bullet) {
          items.push(bullet);
        }
      }
    }
  }

  return items;
}

/**
 * Lê memórias nativas adicionadas pelo Gemini em GEMINI.md.
 * @param {string} geminiFilePath Caminho para o arquivo GEMINI.md (geralmente ~/.gemini/GEMINI.md)
 * @returns {Array<{ texto: string, origem: string }>}
 */
function harvestGeminiFile(geminiFilePath) {
  if (!fs.existsSync(geminiFilePath) || !fs.statSync(geminiFilePath).isFile()) {
    return [];
  }

  const content = fs.readFileSync(geminiFilePath, "utf8");
  const bullets = extractGeminiMemories(content);
  const fileName = path.basename(geminiFilePath);

  return bullets.map((texto) => ({
    texto,
    origem: `harvest:gemini:${fileName}`,
  }));
}

module.exports = {
  extractGeminiMemories,
  harvestGeminiFile,
};

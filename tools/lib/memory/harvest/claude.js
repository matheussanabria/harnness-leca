// @ts-check
// Coletor de memórias nativas do Claude Code (EP-13.08).
// Lê, somente leitura:
//   1. Linhas fora do bloco gerenciado em MEMORY.md
//   2. Arquivos *.md dentro de memory/ que NÃO possuam o marcador <!-- harness:generated -->
const fs = require("fs");
const path = require("path");

const BEGIN = "<!-- harness:begin -->";
const END = "<!-- harness:end -->";
const GENERATED = "<!-- harness:generated -->";

/**
 * Extrai linhas ou bullets de um texto de MEMORY.md que estejam fora do bloco gerenciado.
 * @param {string} text
 * @returns {string[]}
 */
function extractOutsideManagedBlock(text) {
  if (!text) return [];
  const b = text.indexOf(BEGIN);
  const e = b >= 0 ? text.indexOf(END, b) : -1;

  let outside = text;
  if (b >= 0 && e >= 0) {
    outside = text.slice(0, b) + "\n" + text.slice(e + END.length);
  }

  const results = [];
  for (const rawLine of outside.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("<!--")) continue;
    const bullet = trimmed.replace(/^[-*]\s+/, "").trim();
    if (bullet.length > 0) {
      results.push(bullet);
    }
  }
  return results;
}

/**
 * Lê memórias nativas do Claude Code em um diretório de projeto.
 * @param {string} claudeProjectDir Diretório da pasta do projeto no Claude (ex: ~/.claude/projects/c--Users-...)
 * @returns {Array<{ texto: string, origem: string }>}
 */
function harvestClaudeDir(claudeProjectDir) {
  const memDir = path.join(claudeProjectDir, "memory");
  if (!fs.existsSync(memDir) || !fs.statSync(memDir).isDirectory()) {
    return [];
  }

  /** @type {Array<{ texto: string, origem: string }>} */
  const items = [];
  const entries = fs.readdirSync(memDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const fullPath = path.join(memDir, entry.name);
    const content = fs.readFileSync(fullPath, "utf8");

    // Ignora arquivos gerados pelo harness
    if (content.includes(GENERATED)) continue;

    if (entry.name.toUpperCase() === "MEMORY.MD") {
      const outsideLines = extractOutsideManagedBlock(content);
      for (const line of outsideLines) {
        items.push({
          texto: line,
          origem: `harvest:claude:${entry.name}`,
        });
      }
    } else {
      // Arquivo avulso criado pelo Claude Code
      // Se tiver frontmatter YAML com description ou name, aproveita
      let texto = "";
      const fmMatch = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
      if (fmMatch) {
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
        if (descMatch) {
          texto = descMatch[1].replace(/^["']|["']$/g, "").trim();
        }
      }
      if (!texto) {
        // Pega a primeira linha de conteúdo não-título
        for (const l of (fmMatch ? (fmMatch[2] || "") : content).split(/\r?\n/)) {
          const t = l.trim().replace(/^[-*#]\s*/, "").trim();
          if (t && !t.startsWith("---")) {
            texto = t;
            break;
          }
        }
      }
      if (texto) {
        items.push({
          texto,
          origem: `harvest:claude:${entry.name}`,
        });
      }
    }
  }

  return items;
}

module.exports = {
  extractOutsideManagedBlock,
  harvestClaudeDir,
};

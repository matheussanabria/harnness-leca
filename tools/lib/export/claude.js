// @ts-check
// Destino Claude Code: ~/.claude/projects/<pasta>/memory/MEMORY.md (somente bloco gerenciado).

const path = require("path");
const { ROOT } = require("../root");

/** Pastas conhecidas do Claude Code quando ainda não existem em ~/.claude/projects. */
const KNOWN_GIT_MAPPINGS = {
  "57multimarcas": "c--Users-matheuss-rodrigues-git-57multimarcas",
  "saude-dispensacao": "c--Users-matheuss-rodrigues-git-saude-dispensacao",
  "saude-prontuario": "c--Users-matheuss-rodrigues-git-saude-prontuario",
  "conversor-relatorio-maquininhas": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas",
  "conversor-relatorio-maquininhas-meu": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas-meu",
  "dai": "c--Users-matheuss-rodrigues-git-DAI",
};

/** Arquivos que versões antigas do export geravam e que não são mais exportados. */
const LEGACY_FILES = ["regras-e-diretrizes.md", "historico-conversas.md", "memorias-consolidadas.md"];

/** Ponteiro curto, sem repetir fatos. */
function pointerBlock(slug) {
  return `A memória curada do harness chega pelo hook em ${ROOT}; ver projects/${slug}/memory.md`;
}

/**
 * @param {{ slug: string }} data
 * @param {string[]} claudeDirs pastas do Claude Code já existentes para o projeto
 * @param {{ claudeProjectsDir: string }} targets
 */
function planClaude(data, claudeDirs, targets) {
  const dirs = claudeDirs.length ? claudeDirs : KNOWN_GIT_MAPPINGS[data.slug] ? [KNOWN_GIT_MAPPINGS[data.slug]] : [];
  const writes = [];
  const legacy = [];
  for (const dir of dirs) {
    const memoryDir = path.join(targets.claudeProjectsDir, dir, "memory");
    writes.push({
      dest: "claude",
      kind: "managed",
      root: targets.claudeProjectsDir,
      file: path.join(memoryDir, "MEMORY.md"),
      content: pointerBlock(data.slug),
      legacy: [/^# Memória do Projeto: /m],
    });
    for (const f of LEGACY_FILES) legacy.push({ dest: "claude", root: targets.claudeProjectsDir, file: path.join(memoryDir, f) });
  }
  return { writes, legacy, folders: dirs.length };
}

module.exports = { planClaude, KNOWN_GIT_MAPPINGS, LEGACY_FILES };

// @ts-check
// Executável do Claude Code (CLAUDE_BIN, claude.exe no PATH ou o do pacote npm @anthropic-ai/claude-code).
// Regras de busca e motivo do shell:false: ver tools/lib/bin.js.
const { makeResolver } = require("./bin");

const claude = makeResolver({ name: "claude", envVar: "CLAUDE_BIN", npmExe: ["@anthropic-ai", "claude-code", "bin", "claude.exe"] });

module.exports = { resolveClaudeBin: claude.resolve, resetClaudeBin: claude.reset };

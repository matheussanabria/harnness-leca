// Executável do Codex (CODEX_BIN ou codex.exe no PATH), sempre absoluto para shell:false.
const { makeResolver } = require("./bin");

const codex = makeResolver({ name: "codex", envVar: "CODEX_BIN", npmExe: ["@openai", "codex", "bin", "codex.exe"] });

module.exports = { resolveCodexBin: codex.resolve, resetCodexBin: codex.reset };

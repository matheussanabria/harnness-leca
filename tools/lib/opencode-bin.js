// @ts-check
// Executável do opencode (OPENCODE_BIN, opencode.exe no PATH ou o do pacote npm opencode-ai).
// Regras de busca e motivo do shell:false: ver tools/lib/bin.js.
const { makeResolver } = require("./bin");

const opencode = makeResolver({ name: "opencode", envVar: "OPENCODE_BIN", npmExe: ["opencode-ai", "bin", "opencode.exe"] });

module.exports = { resolveOpencodeBin: opencode.resolve, resetOpencodeBin: opencode.reset };

// @ts-check
// Executável do opencode (OPENCODE_BIN, opencode.exe no PATH ou o do pacote npm opencode-ai).
// Regras de busca e motivo do shell:false: ver tools/lib/bin.js.
const { makeResolver } = require("./bin");

const opencode = makeResolver({ name: "opencode", envVar: "OPENCODE_BIN", npmExe: [["@opencode", "cli", "bin", "opencode.exe"], ["opencode-ai", "bin", "opencode.exe"]] });

/**
 * Argumentos de `opencode run` na v2: sem --pure/--dir (a pasta é o cwd do processo); --standalone usa servidor próprio,
 * pois o de fundo exige senha. `auto` aprova o que a configuração não nega (necessário para editar em modo não interativo).
 * @param {{ agent: string, model: string, auto?: boolean }} o
 */
const opencodeRunArgs = ({ agent, model, auto }) => ["run", "--standalone", "--agent", agent, "-m", model, "--format", "json", ...(auto ? ["--auto"] : [])];

/** A v2 deriva a pasta do projeto de PWD/INIT_CWD herdados (não do cwd do spawn): sem isto edita o repositório do chamador. */
const opencodeCwdEnv = (/** @type {string} */ dir, extra = {}) => ({ ...process.env, ...extra, PWD: dir, INIT_CWD: dir });

module.exports = { resolveOpencodeBin: opencode.resolve, resetOpencodeBin: opencode.reset, opencodeRunArgs, opencodeCwdEnv };

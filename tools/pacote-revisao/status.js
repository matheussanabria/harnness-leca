// @ts-check
// Estado barato do pacote (sem Vite e sem ler o Jira): quando foi gerado e quais grupos de fonte mudaram desde entao.
const { fingerprint, readManifest } = require("./manifest");

/**
 * @param {{ repo: string, projectDir: string, configFile: string, outDir: string, config: any }} ctx
 * @returns {{ pasta: string, geradoEm: string|null, defasado: string[] }}
 */
function packageStatus(ctx) {
  const mf = readManifest(ctx.outDir);
  if (!mf) return { pasta: ctx.outDir, geradoEm: null, defasado: [] };
  const now = fingerprint({ repo: ctx.repo, projectDir: ctx.projectDir, configFile: ctx.configFile, outDir: ctx.outDir, historias: ctx.config.historias });
  const defasado = Object.keys(now).filter((grupo) => !mf.fontes || mf.fontes[grupo] !== now[grupo]);
  return { pasta: ctx.outDir, geradoEm: mf.geradoEm || null, defasado };
}

module.exports = { packageStatus };

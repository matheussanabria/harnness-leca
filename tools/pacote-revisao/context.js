// @ts-check
// Contexto de um pacote: projeto, repositorio, configuracao e pasta de saida. Compartilhado pelo CLI e pelo servidor.
const fs = require("fs");
const path = require("path");
const { loadConfig, projectsDir, repoDirOf } = require("./config");

/**
 * @param {{ project?: string|boolean, config?: string|boolean, out?: string|boolean }} opts
 */
function context(opts) {
  const slug = String(opts.project || "");
  if (!slug) throw new Error("--project e obrigatorio");
  const projectDir = path.join(projectsDir(), slug);
  if (!fs.existsSync(projectDir)) throw new Error(`projeto nao encontrado: ${slug}`);
  const repo = repoDirOf(slug);
  if (!repo) throw new Error(`o projeto ${slug} nao declara "repo" em mcp.json`);
  const { file, config } = loadConfig(slug, opts.config ? String(opts.config) : undefined);
  const out = String(opts.out || config.pasta || "");
  if (!out) throw new Error("informe --out <pasta> ou \"pasta\" na configuracao");
  return { slug, projectDir, repo, configFile: file, config, outDir: path.resolve(out) };
}

/** O projeto tem configuracao de pacote? (sem validar nada alem de existir) @param {string} slug */
function hasConfig(slug) {
  return fs.existsSync(path.join(projectsDir(), slug, "pacote-revisao.json"));
}

module.exports = { context, hasConfig };

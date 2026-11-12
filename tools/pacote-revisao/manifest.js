// @ts-check
// Manifesto do pacote: impressao digital das fontes no momento da geracao. O `check` compara com o estado atual
// e diz o que mudou desde entao, sem depender de alguem lembrar de regerar.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MANIFEST = ".pacote-revisao.json";

/** @param {string} file */
function hashFile(file) {
  if (!fs.existsSync(file)) return "ausente";
  return crypto.createHash("sha256").update(fs.readFileSync(file).toString("utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
}

/** @param {string} dir @returns {string[]} arquivos (recursivo, ordenado) */
function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesIn(full));
    else out.push(full);
  }
  return out.sort();
}

/** @param {string[]} files */
function hashGroup(files) {
  const h = crypto.createHash("sha256");
  for (const f of files) h.update(path.basename(f) + ":" + hashFile(f) + ";");
  return h.digest("hex").slice(0, 16);
}

/**
 * Fontes que alimentam o pacote, em grupos com nome legivel.
 * @param {{ repo: string, projectDir: string, configFile: string, outDir: string, historias: string[] }} p
 * @returns {Record<string, string>}
 */
function fingerprint({ repo, projectDir, configFile, outDir, historias }) {
  const feat = path.join(repo, "doc", "sistema", "features");
  const maps = fs.existsSync(feat) ? fs.readdirSync(feat).map((d) => path.join(feat, d, "mapa-camadas.json")).filter(fs.existsSync) : [];
  const protoFiles = filesIn(path.join(projectDir, "design", "prototypes")).filter((f) => /\.(html|json)$/.test(f));
  return {
    configuracao: hashFile(configFile),
    "mapa-camadas.json": hashGroup(maps),
    "mapa em camadas original (HTML)": hashFile(path.join(feat, "Mapa em camadas DIS.html")),
    "vinculos historia-funcionalidade": hashFile(path.join(feat, "_historias-funcionalidades.json")),
    "prototipos ligados as telas": hashFile(path.join(feat, "_prototipos.json")),
    "prototipos (HTML e json)": hashGroup(protoFiles),
    "snapshot do Jira": hashFile(path.join(repo, "doc", "scrum", "_jira-dis.json")),
    "quadro local (scrum.json)": hashFile(path.join(projectDir, "scrum.json")),
    "arquivos das historias no pacote": hashGroup(historias.flatMap((k) => filesIn(path.join(outDir, "doc", "scrum", k)))),
  };
}

/** @param {string} outDir @param {object} data */
function writeManifest(outDir, data) {
  fs.writeFileSync(path.join(outDir, MANIFEST), JSON.stringify(data, null, 2) + "\n");
}

/** @param {string} outDir */
function readManifest(outDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(outDir, MANIFEST), "utf8"));
  } catch {
    return null;
  }
}

module.exports = { fingerprint, writeManifest, readManifest, MANIFEST, hashFile };

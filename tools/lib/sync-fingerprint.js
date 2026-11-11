// @ts-check
// Cache de impressao digital das fontes de conversa: o sync pula o parse de sessoes que nao mudaram.
// Guardado em logs/sync-fingerprints.json (ignorado pelo git). Mude IMPORTER_VERSION ao alterar o formato gerado, para reconverter tudo.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./root");

const IMPORTER_VERSION = 2;
const FILE = () => path.join(ROOT, "logs", "sync-fingerprints.json");

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE(), "utf8"));
    return data && data.version === IMPORTER_VERSION ? data : { version: IMPORTER_VERSION, items: {} };
  } catch { return { version: IMPORTER_VERSION, items: {} }; }
}

/** Abre o cache para uma execucao. `unchanged` exige tambem que o .md da sessao ainda exista em chatsDir. */
function open() {
  const data = load();
  let dirty = false;
  return {
    /** Devolve o nome do .md gravado antes (verdadeiro) se a fonte nao mudou; "" se precisa converter. */
    /** @param {string} key @param {string} fp @param {string} chatsDir @param {string} shortId @returns {string} */
    unchanged(key, fp, chatsDir, shortId) {
      const slot = data.items[key];
      if (!slot || slot.fp !== fp || slot.dir !== chatsDir) return "";
      try { return fs.readdirSync(chatsDir).find((f) => f.endsWith(`-${shortId}.md`)) || ""; } catch { return ""; }
    },
    /** @param {string} key @param {string} fp @param {string} chatsDir */
    remember(key, fp, chatsDir) { data.items[key] = { fp, dir: chatsDir }; dirty = true; },
    save() {
      if (!dirty) return;
      try { fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(data)); } catch { /* cache e opcional */ }
    },
  };
}

module.exports = { open, IMPORTER_VERSION };

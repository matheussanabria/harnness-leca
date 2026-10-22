// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");

const TRASH_DIR = ".trash";

/**
 * Exclui um protótipo do projeto.
 * - Protótipo do Ateliê (pasta em design/prototypes/<id>): a pasta vai para design/prototypes/.trash/<id>-<timestamp>,
 *   então nada é apagado de vez e dá para recuperar à mão. O catálogo ignora pastas que começam com ponto.
 * - Entrada de design/design.json (artefato ou protótipo listado): a entrada é removida. O arquivo HTML do
 *   artefato, se existir, não é tocado.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ fs: any, path: any, now?: () => number }} [deps]
 * @returns {{ ok: true, id: string, removedFolder: string | null, removedEntry: boolean, trash: string | null }}
 */
function deletePrototype(projectDir, protoId, deps = { fs, path }) {
  const id = String(protoId || "");
  if (!/^[\w-]+$/.test(id)) throw new Error("Identificador de protótipo inválido.");
  const now = deps.now || Date.now;

  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, id);
  let removedFolder = null;
  let trash = null;
  if (deps.fs.existsSync(protoDir)) {
    const trashRoot = deps.path.join(baseDir, TRASH_DIR);
    deps.fs.mkdirSync(trashRoot, { recursive: true });
    const target = deps.path.join(trashRoot, `${id}-${now()}`);
    moveDir(protoDir, target, deps);
    removedFolder = `design/prototypes/${id}`;
    trash = `design/prototypes/${TRASH_DIR}/${deps.path.basename(target)}`;
  }

  const removedEntry = removeDesignJsonEntry(projectDir, id, deps);
  if (!removedFolder && !removedEntry) throw new Error(`Protótipo '${id}' não encontrado.`);
  return { ok: true, id, removedFolder, removedEntry, trash };
}

/**
 * Move a pasta para a lixeira. No Windows o rename falha (EPERM/EBUSY/EXDEV) quando algum arquivo da pasta
 * está aberto por outro programa; nesse caso copia e remove, e só então considera movida.
 */
function moveDir(from, to, deps) {
  try {
    deps.fs.renameSync(from, to);
    return;
  } catch (err) {
    if (!["EPERM", "EBUSY", "EXDEV", "EACCES", "ENOTEMPTY"].includes(err?.code)) throw err;
  }
  try {
    deps.fs.cpSync(from, to, { recursive: true });
    deps.fs.rmSync(from, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    try { deps.fs.rmSync(to, { recursive: true, force: true }); } catch {}
    throw new Error(`Não foi possível mover a pasta para a lixeira (${err?.code || err?.message}). Feche programas que estejam usando os arquivos e tente de novo.`);
  }
  if (deps.fs.existsSync(from)) {
    try { deps.fs.rmSync(to, { recursive: true, force: true }); } catch {}
    throw new Error("Não foi possível remover a pasta original; nada foi excluído. Feche programas que estejam usando os arquivos e tente de novo.");
  }
}

/** Tira o protótipo da lista `prototypes` do design.json, preservando o resto do arquivo. */
function removeDesignJsonEntry(projectDir, id, deps) {
  const file = deps.path.join(projectDir, "design", "design.json");
  if (!deps.fs.existsSync(file)) return false;
  let data;
  try {
    data = JSON.parse(deps.fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  if (!Array.isArray(data.prototypes)) return false;
  const next = data.prototypes.filter((p) => p?.id !== id);
  if (next.length === data.prototypes.length) return false;
  data.prototypes = next;
  deps.fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return true;
}

module.exports = { deletePrototype, TRASH_DIR };

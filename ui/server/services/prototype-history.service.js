// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");

/**
 * Histórico de alterações de um protótipo do Ateliê (desfazer/refazer e linha do tempo).
 *
 * Cada entrada guarda o estado inteiro dos arquivos do protótipo DEPOIS da ação (caminho -> hash). O conteúdo fica
 * em `.history/blobs/<hash>` (sem duplicar o que não mudou), e `.history/journal.json` guarda a linha do tempo e o
 * cursor. Desfazer/refazer/ir para uma entrada = restaurar os arquivos daquele estado. Sobrevive a reinício do
 * servidor e cobre qualquer escrita: o que for gravado fora do histórico entra como "Alteração externa" na próxima
 * leitura, então também pode ser desfeito.
 */

const HISTORY_DIR = ".history";
const MAX_ENTRIES = 150;
const TOP_FILES = ["proto.json", "head.html", "MAPA.md"];
const TREE_DIRS = ["screens", "styles", "data"];

/** @typedef {{ id: number, ts: string, label: string, kind: string, detail: string, files: Record<string, string>, changed: string[] }} Entry */
/** @typedef {{ schema: number, seq: number, cursor: number, entries: Entry[] }} Journal */

const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
const historyDir = (protoDir) => path.join(protoDir, HISTORY_DIR);

/** Campos do proto.json que mudam sozinhos (versão e data) não contam como alteração nem voltam no desfazer. */
function stripVolatile(manifest) {
  const copy = { ...manifest };
  delete copy.version;
  if (copy.metadata && typeof copy.metadata === "object") {
    copy.metadata = { ...copy.metadata };
    delete copy.metadata.updatedAt;
  }
  return copy;
}

/** Conteúdo rastreado de um arquivo (proto.json é normalizado). */
function readTracked(protoDir, rel) {
  const buf = fs.readFileSync(path.join(protoDir, rel));
  if (rel !== "proto.json") return buf;
  try {
    return Buffer.from(JSON.stringify(stripVolatile(JSON.parse(buf.toString("utf8"))), null, 2), "utf8");
  } catch {
    return buf;
  }
}

function walk(dir, rel, out) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const item of items) {
    if (item.name.startsWith(".")) continue;
    const childRel = `${rel}/${item.name}`;
    if (item.isDirectory()) walk(path.join(dir, item.name), childRel, out);
    else if (item.isFile()) out.push(childRel);
  }
}

/** Arquivos que fazem parte do histórico (caminhos com "/"). */
function listTracked(protoDir) {
  const out = TOP_FILES.filter((f) => fs.existsSync(path.join(protoDir, f)));
  for (const dir of TREE_DIRS) walk(path.join(protoDir, dir), dir, out);
  return out.sort();
}

function writeBlob(protoDir, hash, buf) {
  const dir = path.join(historyDir(protoDir), "blobs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, hash);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
}

/** Estado atual do protótipo: guarda o conteúdo novo e devolve caminho -> hash. */
function captureState(protoDir) {
  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of listTracked(protoDir)) {
    const buf = readTracked(protoDir, rel);
    const hash = sha1(buf);
    writeBlob(protoDir, hash, buf);
    files[rel] = hash;
  }
  return files;
}

function sameState(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

function diffPaths(prev, next) {
  const all = new Set([...Object.keys(prev || {}), ...Object.keys(next)]);
  return [...all].filter((k) => (prev || {})[k] !== next[k]).sort();
}

/** @returns {Journal} */
function loadJournal(protoDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(historyDir(protoDir), "journal.json"), "utf8"));
    if (Array.isArray(data.entries) && Number.isInteger(data.cursor)) return { schema: 1, seq: data.seq || data.entries.length, cursor: data.cursor, entries: data.entries };
  } catch {}
  return { schema: 1, seq: 0, cursor: -1, entries: [] };
}

function saveJournal(protoDir, journal) {
  const dir = historyDir(protoDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "journal.json");
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(journal), "utf8");
  fs.renameSync(tmp, file);
}

/** Remove blobs que nenhuma entrada usa mais. */
function collectGarbage(protoDir, journal) {
  const used = new Set();
  for (const entry of journal.entries) for (const hash of Object.values(entry.files)) used.add(hash);
  const dir = path.join(historyDir(protoDir), "blobs");
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) if (!used.has(name)) { try { fs.rmSync(path.join(dir, name), { force: true }); } catch {} }
}

function pushEntry(protoDir, journal, files, meta) {
  const prev = journal.entries[journal.cursor];
  // Uma ação nova depois de desfazer descarta o "refazer".
  journal.entries = journal.entries.slice(0, journal.cursor + 1);
  journal.seq += 1;
  journal.entries.push({
    id: journal.seq,
    ts: new Date().toISOString(),
    label: meta.label,
    kind: meta.kind || "edit",
    detail: meta.detail || "",
    files,
    changed: diffPaths(prev && prev.files, files),
  });
  let pruned = false;
  // Pontos marcados (checkpoints) nunca são descartados pelo limite.
  while (journal.entries.length > MAX_ENTRIES) {
    const drop = journal.entries.findIndex((e) => !e.pinned);
    if (drop < 0) break;
    journal.entries.splice(drop, 1);
    pruned = true;
  }
  journal.cursor = journal.entries.length - 1;
  if (pruned) collectGarbage(protoDir, journal);
}

/**
 * Garante que o diário reflete o disco: cria o "Estado inicial" ou registra "Alteração externa"
 * quando algo foi gravado sem passar pelo histórico.
 */
function syncJournal(protoDir, journal) {
  const files = captureState(protoDir);
  const current = journal.entries[journal.cursor];
  if (!current) {
    pushEntry(protoDir, journal, files, { label: "Estado inicial", kind: "baseline" });
    return true;
  }
  if (!sameState(current.files, files)) {
    pushEntry(protoDir, journal, files, { label: "Alteração externa", kind: "external", detail: "Gravada fora do histórico (arquivo editado, chat ou outra ferramenta)." });
    return true;
  }
  return false;
}

function protoDirOf(projectDir, protoId) {
  if (!/^[\w-]+$/.test(protoId || "")) throw new Error("ID de protótipo inválido.");
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);
  if (!fs.existsSync(protoDir)) throw new Error(`Protótipo '${protoId}' não encontrado.`);
  return protoDir;
}

/** Fotografa o estado antes de uma alteração. */
function beginChange(projectDir, protoId) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  if (syncJournal(protoDir, journal)) saveJournal(protoDir, journal);
}

/**
 * Registra a alteração feita depois de `beginChange`.
 * @param {{ label: string, kind?: string, detail?: string }} meta
 * @returns {Entry | null} a entrada criada (null se nada mudou)
 */
function commitChange(projectDir, protoId, meta) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  if (!journal.entries.length) syncJournal(protoDir, journal);
  const files = captureState(protoDir);
  const current = journal.entries[journal.cursor];
  if (current && sameState(current.files, files)) return null;
  pushEntry(protoDir, journal, files, meta);
  saveJournal(protoDir, journal);
  return journal.entries[journal.cursor];
}

/**
 * Executa uma alteração registrando-a no histórico. `fn` que devolve `{ ok: false }` ou lança erro não cria entrada.
 * @template T
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ label: string, kind?: string, detail?: string } | ((result: T) => { label: string, kind?: string, detail?: string })} meta
 * @param {() => T} fn
 * @returns {T}
 */
function withHistory(projectDir, protoId, meta, fn) {
  try { beginChange(projectDir, protoId); } catch { return fn(); } // sem pasta/protótipo: deixa a rota responder o erro de sempre
  const result = fn();
  if (result && /** @type {any} */ (result).ok === false) return result;
  try {
    commitChange(projectDir, protoId, typeof meta === "function" ? meta(result) : meta);
  } catch {}
  return result;
}

/**
 * Marca (ou desmarca, com nome vazio) uma entrada como ponto nomeado. Não cria entrada nem mexe no "refazer".
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} name
 * @param {number} [index] padrão: o estado atual
 */
function markCheckpoint(projectDir, protoId, name, index) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  syncJournal(protoDir, journal);
  const at = Number.isInteger(index) ? /** @type {number} */ (index) : journal.cursor;
  const entry = journal.entries[at];
  if (!entry) return { ok: false, error: "Entrada do histórico não encontrada." };
  const clean = String(name || "").trim().slice(0, 80);
  if (clean) { entry.pinned = true; entry.checkpoint = clean; } else { delete entry.pinned; delete entry.checkpoint; }
  saveJournal(protoDir, journal);
  return { ok: true, ...summarize(journal) };
}

function summarize(journal) {
  return {
    cursor: journal.cursor,
    canUndo: journal.cursor > 0,
    canRedo: journal.cursor < journal.entries.length - 1,
    entries: journal.entries.map((e, index) => ({ index, id: e.id, ts: e.ts, label: e.label, kind: e.kind, detail: e.detail, changed: e.changed, checkpoint: e.checkpoint || "", current: index === journal.cursor })),
  };
}

/** Linha do tempo do protótipo. */
function listHistory(projectDir, protoId) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  if (syncJournal(protoDir, journal)) saveJournal(protoDir, journal);
  return summarize(journal);
}

/** Grava os arquivos de uma entrada no disco (só os que diferem) e apaga os que não existiam naquele estado. */
function restoreState(protoDir, target) {
  const current = captureState(protoDir);
  for (const rel of diffPaths(current, target)) {
    const abs = path.join(protoDir, rel);
    if (!(rel in target)) { fs.rmSync(abs, { force: true }); continue; }
    let buf = fs.readFileSync(path.join(historyDir(protoDir), "blobs", target[rel]));
    if (rel === "proto.json") {
      // versão e data seguem os do disco: restaurar o manifesto não pode fazer a numeração de versões andar para trás
      try {
        const live = JSON.parse(fs.readFileSync(abs, "utf8"));
        const restored = JSON.parse(buf.toString("utf8"));
        if (live.version !== undefined) restored.version = live.version;
        if (live.metadata && live.metadata.updatedAt) restored.metadata = { ...(restored.metadata || {}), updatedAt: live.metadata.updatedAt };
        buf = Buffer.from(JSON.stringify(restored, null, 2), "utf8");
      } catch {}
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, abs);
  }
}

/** Vai para a entrada `index` do histórico (desfazer, refazer e pular na linha do tempo). */
function goToEntry(projectDir, protoId, index) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  syncJournal(protoDir, journal);
  if (!Number.isInteger(index) || index < 0 || index >= journal.entries.length) {
    saveJournal(protoDir, journal);
    return { ok: false, error: "Entrada do histórico não encontrada." };
  }
  if (index !== journal.cursor) {
    restoreState(protoDir, journal.entries[index].files);
    journal.cursor = index;
  }
  saveJournal(protoDir, journal);
  return { ok: true, ...summarize(journal), entry: summarize(journal).entries[index] };
}

function undoHistory(projectDir, protoId) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  syncJournal(protoDir, journal);
  saveJournal(protoDir, journal);
  if (journal.cursor <= 0) return { ok: false, error: "Nada para desfazer." };
  return goToEntry(projectDir, protoId, journal.cursor - 1);
}

function redoHistory(projectDir, protoId) {
  const protoDir = protoDirOf(projectDir, protoId);
  const journal = loadJournal(protoDir);
  syncJournal(protoDir, journal);
  saveJournal(protoDir, journal);
  if (journal.cursor >= journal.entries.length - 1) return { ok: false, error: "Nada para refazer." };
  return goToEntry(projectDir, protoId, journal.cursor + 1);
}

/** Rótulo legível de uma operação de `edit/apply`. */
function labelForEditOp(op) {
  const labels = {
    setText: "Editar texto", setClasses: "Alterar classes", setAttr: "Alterar atributo", setToken: "Alterar token de estilo",
    setStyles: "Alterar estilo", moveTo: "Mover elemento", setHtml: "Alterar componente",
  };
  return (op && labels[op.type]) || "Editar elemento";
}

/** Rótulo legível de uma operação de `edit/structural`. */
function labelForStructuralOp(op) {
  if (op && op.type === "group") return `Agrupar ${Array.isArray(op.pids) ? new Set([...(op.pids), ...(op.pid ? [op.pid] : [])]).size : ""} elementos`.replace("  ", " ");
  if (op && (op.type === "remove" || op.type === "duplicate") && Array.isArray(op.pids) && op.pids.length > 1) {
    return `${op.type === "remove" ? "Excluir" : "Duplicar"} ${op.pids.length} elementos`;
  }
  const labels = { remove: "Excluir elemento", duplicate: "Duplicar elemento", insertBlock: "Inserir bloco", move: "Mover elemento", ungroup: "Desagrupar elementos" };
  return (op && labels[op.type]) || "Alterar estrutura";
}

module.exports = {
  HISTORY_DIR,
  MAX_ENTRIES,
  beginChange,
  commitChange,
  withHistory,
  listHistory,
  goToEntry,
  undoHistory,
  redoHistory,
  markCheckpoint,
  labelForEditOp,
  labelForStructuralOp,
};

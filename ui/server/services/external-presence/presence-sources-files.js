// @ts-check
// Leitores de fontes baseadas em arquivo: Claude Code e Antigravity (somente stat e nomes).
// Nenhum arquivo de transcrito e aberto: o sinal e o mtime e o id vem do nome.
const fs = require("fs");
const path = require("path");
const { THRESHOLDS, ENGINES, COLD_SWEEP_MS } = require("./presence-config");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cache de arquivos frios (mtime antigo demais): evita milhares de stat a cada varredura.
 * Um arquivo frio so e consultado de novo a cada COLD_SWEEP_MS; os quentes, sempre.
 * @returns {Map<string, number>} caminho -> instante da ultima consulta
 */
function createColdCache() {
  return new Map();
}

/**
 * @param {string} file
 * @param {number} nowMs
 * @param {Map<string, number>} [cold]
 * @returns {number | null} mtime; null se nao existe ou se esta frio e ainda nao e hora de rever
 */
function mtimeOf(file, nowMs, cold) {
  const checked = cold?.get(file);
  if (checked !== undefined && nowMs - checked < COLD_SWEEP_MS) return null;
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (cold) {
      if (nowMs - mtime >= THRESHOLDS.noRecentSignalMs) cold.set(file, nowMs);
      else cold.delete(file);
    }
    return mtime;
  } catch {
    cold?.set(file, nowMs); // inexistente conta como frio: nao repetir o stat a cada varredura
    return null;
  }
}

/**
 * Claude Code: <root>/<cwd-slug>/<sessionId>.jsonl. O nome da pasta e o "hint" de projeto.
 * Subagentes ficam em <sessionId>/subagents/ (nao sao .jsonl diretos) e nao entram.
 * @param {string} root
 * @param {number} nowMs
 * @param {Map<string, number>} [cold]
 * @returns {import("./presence-config").Candidate[]}
 */
function readClaude(root, nowMs, cold) {
  /** @type {import("./presence-config").Candidate[]} */
  const out = [];
  let dirs;
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(root, dir.name);
    let files;
    try {
      files = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const mtime = mtimeOf(path.join(dirPath, file.name), nowMs, cold);
      if (mtime === null || nowMs - mtime >= THRESHOLDS.noRecentSignalMs) continue;
      out.push({ engine: ENGINES.claude, nativeId: file.name.slice(0, -".jsonl".length), signalMs: mtime, hint: dir.name });
    }
  }
  return out;
}

/**
 * Antigravity: <brain>/<uuid>/.system_generated/logs/transcript.jsonl nas duas raizes. O hint de
 * projeto nao existe no disco do brain: vem depois, do conversation_summaries.db (hint vazio aqui).
 * Mesma conversa nas duas raizes: vale o sinal mais recente.
 * @param {string[]} brainRoots
 * @param {number} nowMs
 * @param {Map<string, number>} [cold]
 * @returns {import("./presence-config").Candidate[]}
 */
function readAntigravity(brainRoots, nowMs, cold) {
  /** @type {Map<string, import("./presence-config").Candidate>} */
  const byId = new Map();
  for (const root of brainRoots) {
    let dirs;
    try {
      dirs = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dir of dirs) {
      if (!dir.isDirectory() || !UUID_RE.test(dir.name)) continue;
      const mtime = mtimeOf(path.join(root, dir.name, ".system_generated", "logs", "transcript.jsonl"), nowMs, cold);
      if (mtime === null || nowMs - mtime >= THRESHOLDS.noRecentSignalMs) continue;
      const prev = byId.get(dir.name);
      if (!prev || mtime > prev.signalMs) byId.set(dir.name, { engine: ENGINES.antigravity, nativeId: dir.name, signalMs: mtime, hint: "" });
    }
  }
  return [...byId.values()];
}

module.exports = { createColdCache, readClaude, readAntigravity, UUID_RE };

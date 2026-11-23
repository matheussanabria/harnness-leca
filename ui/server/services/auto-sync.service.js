// @ts-check
// Sincronizacao automatica das conversas: observa as pastas dos motores (Claude Code, Gemini, opencode, Codex) e roda
// tools/sync.js (e em seguida tools/export-context.js) em processo filho, com debounce, intervalo minimo e uma unica execucao por vez.
// HARNESS_AUTOSYNC=0 desliga; HARNESS_AUTOSYNC_INTERVAL_MS ajusta o ciclo de seguranca (padrao 5 min).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const DEBOUNCE_MS = 20_000; // espera a rajada de gravacoes terminar
const MIN_GAP_MS = 60_000; // nunca sincroniza mais de uma vez por minuto
const DEFAULT_INTERVAL_MS = 300_000;

const stats = { enabled: false, running: false, runs: 0, skipped: 0, lastStart: 0, lastEnd: 0, lastCode: /** @type {number | null} */ (null), lastTrigger: "" };
let manualBusy = false; // sync manual da interface em andamento (evita gravar os mesmos chats em paralelo)

/** Exclusao mutua com o botao "Sincronizar" da interface. @returns {boolean} true se conseguiu reservar */
function acquireManual() {
  if (manualBusy || stats.running) return false;
  manualBusy = true;
  return true;
}
function releaseManual() { manualBusy = false; }
const isBusy = () => manualBusy || stats.running;

function watchRoots(home = os.homedir()) {
  return [
    path.join(home, ".claude", "projects"),
    path.join(home, ".gemini", "antigravity-ide", "brain"),
    path.join(home, ".local", "share", "opencode"),
    path.join(home, ".codex", "sessions"),
  ].filter((p) => fs.existsSync(p));
}

/** Runs tools/<name> in a child process; resolves with its exit code (-1 when it cannot start). @param {string} root @param {string} name @returns {Promise<number | null>} */
function runTool(root, name) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, ["--no-warnings", path.join(root, "tools", name)], { cwd: root, env: process.env, windowsHide: true, stdio: "ignore" });
    } catch { return resolve(-1); }
    child.on("error", () => resolve(-1));
    child.on("close", resolve);
  });
}

/**
 * One cycle: sync the conversations, then refresh the context the engines read (instructions, memory index, Codex
 * AGENTS.md). The export is non destructive and idempotent; HARNESS_AUTOEXPORT=0 skips it.
 * @param {string} root @param {string} trigger
 */
function runSync(root, trigger, env = process.env) {
  if (isBusy() || Date.now() - stats.lastEnd < MIN_GAP_MS) { stats.skipped++; return false; }
  stats.running = true; stats.lastStart = Date.now(); stats.lastTrigger = trigger;
  const done = (/** @type {number | null} */ code) => {
    stats.running = false; stats.runs++; stats.lastEnd = Date.now(); stats.lastCode = code;
  };
  runTool(root, "sync.js")
    .then(async (code) => {
      if (String(env.HARNESS_AUTOEXPORT || "").trim() !== "0") await runTool(root, "export-context.js");
      done(code);
    })
    .catch(() => done(-1));
  return true;
}

/** @param {{ root: string, env?: NodeJS.ProcessEnv, debounceMs?: number }} opts */
function startAutoSync({ root, env = process.env, debounceMs = DEBOUNCE_MS }) {
  if (String(env.HARNESS_AUTOSYNC || "").trim() === "0") return null;
  stats.enabled = true;
  /** @type {NodeJS.Timeout | null} */
  let pending = null;
  const schedule = (/** @type {string} */ why) => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; runSync(root, why, env); }, debounceMs);
    pending.unref();
  };
  const watchers = [];
  for (const dir of watchRoots()) {
    try {
      const w = fs.watch(dir, { recursive: true }, (_evt, name) => {
        // so interessa o que e conversa: jsonl do Claude, arquivos do brain, banco do opencode
        if (!name || /\.(jsonl|md|json|db|db-wal)$/i.test(String(name))) schedule("watch");
      });
      w.on("error", () => {});
      watchers.push(w);
    } catch { /* sem watch: o intervalo cobre */ }
  }
  const n = Number(env.HARNESS_AUTOSYNC_INTERVAL_MS);
  const timer = setInterval(() => schedule("interval"), Number.isFinite(n) && n >= 60_000 ? n : DEFAULT_INTERVAL_MS);
  timer.unref();
  schedule("startup");
  return { stop() { clearInterval(timer); if (pending) clearTimeout(pending); for (const w of watchers) w.close(); stats.enabled = false; } };
}

const getAutoSyncStats = () => ({ ...stats, busy: isBusy() });

module.exports = { runSync, runTool, watchRoots, startAutoSync, getAutoSyncStats, acquireManual, releaseManual, isBusy };

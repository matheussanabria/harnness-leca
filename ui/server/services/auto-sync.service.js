// @ts-check
// Sincronizacao automatica das conversas: observa as pastas dos motores (Claude Code, Gemini, opencode, Codex) e roda
// tools/sync.js em processo filho, com debounce, intervalo minimo e uma unica execucao por vez.
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

/** @param {string} root @param {string} trigger */
function runSync(root, trigger) {
  if (isBusy() || Date.now() - stats.lastEnd < MIN_GAP_MS) { stats.skipped++; return false; }
  const script = path.join(root, "tools", "sync.js");
  stats.running = true; stats.lastStart = Date.now(); stats.lastTrigger = trigger;
  let child;
  try {
    child = spawn(process.execPath, ["--no-warnings", script], { cwd: root, env: process.env, windowsHide: true, stdio: "ignore" });
  } catch {
    stats.running = false; stats.lastEnd = Date.now(); stats.lastCode = -1;
    return false;
  }
  const done = (/** @type {number | null} */ code) => {
    if (!stats.running) return;
    stats.running = false; stats.runs++; stats.lastEnd = Date.now(); stats.lastCode = code;
  };
  child.on("error", () => done(-1));
  child.on("close", done);
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
    pending = setTimeout(() => { pending = null; runSync(root, why); }, debounceMs);
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

module.exports = { watchRoots, startAutoSync, getAutoSyncStats, acquireManual, releaseManual, isBusy };

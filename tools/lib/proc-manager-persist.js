// @ts-check
// Persistência dos serviços iniciados pelo Studio e readoção após reinício do servidor da interface.
// O estado vive em memória (proc-manager-store); como o servidor reinicia (ex.: ui:dev com --watch),
// os PIDs vão para temp/proc-manager-state.json e são readotados na primeira consulta do novo processo.
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { ROOT } = require("./root");
const { runningServices } = require("./proc-manager-store");

/** Tolerância entre o início do serviço e o início do processo (wrapper ou listener) */
const START_SKEW_MS = 15000;

/** @typedef {{ slug: string, serviceId: string, name: string, command: string, cwd: string, url: string, pid: number, startedAt: number }} PersistedService */

const stateFile = () => path.join(process.env.HARNESS_ROOT ? path.resolve(process.env.HARNESS_ROOT) : ROOT, "temp", "proc-manager-state.json");

/** @returns {Record<string, PersistedService>} */
function readState() {
  try {
    const data = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, PersistedService>} state */
function writeState(state) {
  try {
    const file = stateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch {}
}

/**
 * @param {string} key
 * @param {PersistedService} entry
 */
function recordStart(key, entry) {
  const state = readState();
  state[key] = entry;
  writeState(state);
}

/** @param {string} key */
function recordStop(key) {
  const state = readState();
  if (!(key in state)) return;
  delete state[key];
  writeState(state);
}

/** @param {number} pid */
function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return /** @type {NodeJS.ErrnoException} */ (err).code === "EPERM";
  }
}

/** @param {string} url */
function portOf(url) {
  try {
    const u = new URL(url);
    return Number(u.port) || (u.protocol === "https:" ? 443 : 80);
  } catch {
    return 0;
  }
}

/**
 * PID que escuta na porta (Windows: netstat; demais: lsof). Null se ninguém escuta.
 * @param {number} port
 * @returns {number | null}
 */
function findListenerPid(port) {
  if (!port) return null;
  try {
    if (process.platform === "win32") {
      const out = cp.execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true });
      for (const line of out.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length >= 5 && /^LISTENING$/i.test(cols[3]) && cols[1].endsWith(`:${port}`)) return Number(cols[4]) || null;
      }
      return null;
    }
    const out = cp.execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
    return Number(out.split(/\r?\n/)[0]) || null;
  } catch {
    return null;
  }
}

/**
 * Início do processo em ms desde a época; null quando não dá para saber (então não bloqueia a readoção).
 * @param {number} pid
 * @returns {number | null}
 */
function startTimeOf(pid) {
  try {
    if (process.platform === "win32") {
      const script = `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds`;
      const out = cp.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true });
      const ms = Math.round(Number(out.trim().replace(",", ".")));
      return Number.isFinite(ms) ? ms : null;
    }
    const out = cp.execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
    const ms = Date.parse(out.trim());
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

let adopted = false;
/** Chaves de serviços readotados (sem ChildProcess real; só o PID) */
const adoptedKeys = new Set();

/**
 * Readota (uma vez por processo) os serviços gravados no estado que continuam vivos.
 * Raiz da árvore: o wrapper (cmd) se ainda existe; senão o processo que escuta na porta do serviço.
 * Só adota se o processo não for mais antigo que o início do serviço registrado (evita PID reutilizado).
 * @param {{ isProcessAlive?: (pid: number) => boolean, findListener?: (port: number) => number | null, startOf?: (pid: number) => number | null }} [deps]
 */
function ensureAdopted(deps = {}) {
  if (adopted) return;
  adopted = true;
  const alive = deps.isProcessAlive || isAlive;
  const listener = deps.findListener || findListenerPid;
  const startOf = deps.startOf || startTimeOf;
  /** @param {number} pid @param {number} since */
  const notOlder = (pid, since) => {
    const t = startOf(pid);
    return t === null || t >= since - START_SKEW_MS;
  };

  const state = readState();
  let changed = false;
  for (const [key, e] of Object.entries(state)) {
    if (runningServices.has(key)) continue;
    let root = alive(e.pid) && notOlder(e.pid, e.startedAt) ? e.pid : 0;
    if (!root) {
      const lp = listener(portOf(e.url));
      if (lp && alive(lp) && notOlder(lp, e.startedAt)) root = lp;
    }
    if (!root) {
      delete state[key];
      changed = true;
      continue;
    }
    const pid = root;
    const child = /** @type {any} */ ({ pid, exitCode: null, kill: (/** @type {NodeJS.Signals} */ sig) => process.kill(pid, sig || "SIGTERM") });
    const when = new Date().toLocaleTimeString();
    adoptedKeys.add(key);
    runningServices.set(key, {
      slug: e.slug, serviceId: e.serviceId, name: e.name, command: e.command, cwd: e.cwd, url: e.url,
      child, pid, startedAt: e.startedAt, status: "running", exitCode: null, listeners: new Set(),
      logs: [`[${when}] Serviço readotado após reinício do Harness (pid ${pid}); o log anterior não está disponível.`],
    });
  }
  if (changed) writeState(state);
}

/** Remove da memória e do estado os serviços readotados cujo processo já terminou. */
function pruneAdoptedDead() {
  for (const key of [...adoptedKeys]) {
    const info = runningServices.get(key);
    if (!info) {
      adoptedKeys.delete(key);
    } else if (!isAlive(info.pid)) {
      runningServices.delete(key);
      adoptedKeys.delete(key);
      recordStop(key);
    }
  }
}

/** Só para testes: permite repetir a readoção no mesmo processo. */
function resetAdoptionForTests() {
  adopted = false;
  adoptedKeys.clear();
}

module.exports = { recordStart, recordStop, ensureAdopted, pruneAdoptedDead, resetAdoptionForTests, readState };

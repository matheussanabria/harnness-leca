// @ts-check
// Descoberta de portas TCP em escuta dos processos do OpenCode. A camada de comandos do sistema operacional
// (`sys`) é injetável: os testes passam listas prontas e nenhum comando real roda.
const { execFile } = require("child_process");

const RUN_TIMEOUT_MS = 4000;

/** @typedef {{ platform: string, run: (cmd: string, args: string[]) => Promise<string> }} OsLayer */

/** @type {OsLayer} */
const realSys = {
  platform: process.platform,
  run: (cmd, args) => new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: RUN_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err); else resolve(String(stdout));
    });
  }),
};

// Regex com colchetes: a linha de comando do próprio powershell/pgrep não casa consigo mesma.
const CMDLINE_PATTERN = "open[c]ode";

/** @param {string} csv saída de `tasklist /fo csv /nh` */
function pidsByImageName(csv) {
  const pids = [];
  for (const line of csv.split(/\r?\n/)) {
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if (m && /opencode/i.test(m[1])) pids.push(m[2]);
  }
  return pids;
}

/** @param {string} netstat saída de `netstat -ano` @param {Set<string>} pids */
function portsFromNetstat(netstat, pids) {
  const ports = [];
  for (const line of netstat.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    const pid = cols[cols.length - 1];
    const local = cols[1] || "";
    const port = local.slice(local.lastIndexOf(":") + 1);
    if (pids.has(pid) && /^\d+$/.test(port)) ports.push(Number(port));
  }
  return ports;
}

/** @param {string} lsof */
function portsFromLsof(lsof) {
  const ports = [];
  for (const m of lsof.matchAll(/:(\d+)\s+\(LISTEN\)/g)) ports.push(Number(m[1]));
  return ports;
}

async function tryRun(sys, cmd, args, errors) {
  try { return await sys.run(cmd, args); } catch (err) {
    errors.push(`${cmd}: ${err && err.message ? err.message : err}`);
    return "";
  }
}

/**
 * Portas em escuta de processos chamados opencode e de hospedeiros (node/bun/deno) cuja linha de comando contém "opencode".
 * @param {OsLayer} [sys]
 * @returns {Promise<{ ports: number[], errors: string[] }>}
 */
async function discoverPorts(sys = realSys) {
  const errors = [];
  const pids = new Set();
  const ports = new Set();
  if (sys.platform === "win32") {
    for (const p of pidsByImageName(await tryRun(sys, "tasklist", ["/fo", "csv", "/nh"], errors))) pids.add(p);
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '${CMDLINE_PATTERN}' } | ForEach-Object { $_.ProcessId }`;
    for (const p of (await tryRun(sys, "powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], errors)).split(/\s+/)) {
      if (/^\d+$/.test(p)) pids.add(p);
    }
    if (pids.size) for (const p of portsFromNetstat(await tryRun(sys, "netstat", ["-ano"], errors), pids)) ports.add(p);
  } else {
    for (const args of [["-x", "opencode"], ["-f", CMDLINE_PATTERN]]) {
      for (const p of (await tryRun(sys, "pgrep", args, errors)).split(/\s+/)) if (/^\d+$/.test(p)) pids.add(p);
    }
    for (const pid of pids) {
      for (const p of portsFromLsof(await tryRun(sys, "lsof", ["-Pan", "-p", pid, "-iTCP", "-sTCP:LISTEN"], errors))) ports.add(p);
    }
  }
  return { ports: [...ports], errors };
}

module.exports = { discoverPorts, realSys, pidsByImageName, portsFromNetstat, portsFromLsof };

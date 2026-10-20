// @ts-check
// Início, parada e logs dos serviços.
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { PROJECTS, runningServices } = require("./proc-manager-store");
const { killTree } = require("./proc-manager-core");
const { getProjectRepoDir } = require("./proc-manager-config");
const { listProjectServices } = require("./proc-manager-services");

/**
 * Inicia a execução de um serviço de desenvolvimento para um projeto
 * @param {string} slug
 * @param {string} [serviceId="default"]
 * @returns {Promise<{ ok: boolean, status: string, pid?: number, error?: string }>}
 */
async function startService(slug, serviceId = "default") {
  const services = listProjectServices(slug);
  const srv = services.find((s) => s.id === serviceId) || services[0];
  if (!srv) {
    return { ok: false, status: "error", error: "Serviço não encontrado" };
  }

  const key = `${slug}:${srv.id}`;
  const existing = runningServices.get(key);
  if (existing && existing.child && existing.child.exitCode === null) {
    return { ok: true, status: existing.status, pid: existing.pid };
  }

  const targetCwd = fs.existsSync(srv.cwd) ? srv.cwd : (getProjectRepoDir(slug) || path.join(PROJECTS, slug));

  // Executa o comando via shell
  const child = cp.spawn(srv.command, [], {
    cwd: targetCwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  const logs = [];
  /**
   * @param {string} text
   * @param {'stdout'|'stderr'|'status'} [type]
   */
  const addLog = (text, type = "stdout") => {
    const lines = text.split(/\r?\n/);
    for (const l of lines) {
      if (!l.trim()) continue;
      const entry = `[${new Date().toLocaleTimeString()}] ${l}`;
      logs.push(entry);
      if (logs.length > 400) logs.shift(); // Mantém últimas 400 linhas
      for (const listener of info.listeners) {
        try { listener({ type, text: entry }); } catch {}
      }
    }
  };

  /** @type {typeof runningServices extends Map<any, infer V> ? V : never} */
  const info = {
    slug,
    serviceId: srv.id,
    name: srv.name,
    command: srv.command,
    cwd: targetCwd,
    url: srv.url,
    child,
    pid: child.pid || 0,
    startedAt: Date.now(),
    logs,
    status: "starting",
    exitCode: null,
    listeners: new Set(),
  };
  runningServices.set(key, info);

  addLog(`🚀 Iniciando: ${srv.command} em ${targetCwd}`);

  child.stdout?.on("data", (chunk) => {
    addLog(chunk.toString(), "stdout");
    info.status = "running";
  });

  child.stderr?.on("data", (chunk) => {
    addLog(chunk.toString(), "stderr");
  });

  child.on("error", (err) => {
    info.status = "failed";
    addLog(`❌ Falha ao iniciar processo: ${err.message}`, "stderr");
  });

  child.on("close", (code) => {
    info.exitCode = code;
    info.status = code === 0 ? "stopped" : "failed";
    addLog(`⏹ Processo finalizado com código ${code}`);
    for (const listener of info.listeners) {
      try { listener({ type: "status", text: `STATUS: ${info.status}` }); } catch {}
    }
  });

  return { ok: true, status: info.status, pid: info.pid };
}

/**
 * Interrompe a execução de um serviço
 * @param {string} slug
 * @param {string} [serviceId]
 */
function stopService(slug, serviceId) {
  let stoppedAny = false;
  for (const [key, info] of runningServices.entries()) {
    if (info.slug === slug && (!serviceId || info.serviceId === serviceId)) {
      if (info.child && info.child.exitCode === null) {
        killTree(info.child);
        info.status = "stopped";
        stoppedAny = true;
      }
      runningServices.delete(key);
    }
  }
  return { ok: true, stopped: stoppedAny };
}

/**
 * Obtém os logs recentes de um serviço
 * @param {string} slug
 * @param {string} [serviceId="default"]
 * @returns {{ logs: string[], status: string, pid?: number }}
 */
function getServiceLogs(slug, serviceId = "default") {
  const key = `${slug}:${serviceId}`;
  const info = runningServices.get(key);
  if (info) {
    return { logs: info.logs, status: info.status, pid: info.pid };
  }
  return { logs: [], status: "stopped" };
}

/**
 * Inscreve um ouvinte para streaming de logs em tempo real
 * @param {string} slug
 * @param {string} serviceId
 * @param {(chunk: { type: 'stdout'|'stderr'|'status', text: string }) => void} callback
 * @returns {() => void} Função para cancelar a inscrição
 */
function subscribeLogs(slug, serviceId, callback) {
  const key = `${slug}:${serviceId}`;
  const info = runningServices.get(key);
  if (!info) return () => {};
  info.listeners.add(callback);
  return () => info.listeners.delete(callback);
}

module.exports = { startService, stopService, getServiceLogs, subscribeLogs };

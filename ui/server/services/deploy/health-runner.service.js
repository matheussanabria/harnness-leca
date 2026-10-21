// @ts-check
// Verificacao real de saude dos ambientes e agregado por ambiente (EP-10.02).
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { readHealthChecks, readHealthRuns, appendHealthRun } = require("./health-store");
const { normalizeCheck, classifyOutcome, aggregateState, fail } = require("./health-definitions");
const { loadDeployConfig, findEnvironment } = require("./deploy-config.service");

const MAX_OUTPUT = 1200;

/**
 * Verifica se o ambiente referenciado existe no catalogo de deploy.
 * @param {string} projectId
 * @param {string} envId
 * @returns {Object}
 */
function requireEnvironment(projectId, envId) {
  const config = loadDeployConfig();
  const found = findEnvironment(config, projectId, envId);
  if (!found) throw fail(400, "Ambiente desconhecido no catalogo de deploy.");
  return found;
}

/**
 * Executa a verificacao http com resultado real.
 * @param {Object} check
 * @returns {Promise<Object>}
 */
async function runHttpCheck(check) {
  const started = Date.now();
  let status = 0;
  let ok = false;
  let detail = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), check.timeoutMs);
    const response = await fetch(check.target, {
      method: check.method || "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = response.status;
    ok = response.status === check.expectedStatus;
    detail = `HTTP ${status} (esperado ${check.expectedStatus})`;
  } catch (err) {
    detail = err.name === "AbortError" ? `Timeout apos ${check.timeoutMs}ms` : `Falha de conexao: ${err.message || err}`;
  }
  return {
    checkId: check.id,
    projectId: check.projectId,
    envId: check.envId,
    type: check.type,
    state: classifyOutcome({ ok }),
    ok,
    httpStatus: status,
    latencyMs: Date.now() - started,
    detail: detail.slice(0, MAX_OUTPUT),
    at: new Date().toISOString(),
  };
}

/**
 * Executa a verificacao de comando, sem shell.
 * @param {Object} check
 * @param {string} cwd
 * @returns {Object}
 */
function runCommandCheck(check, cwd) {
  const started = Date.now();
  const result = spawnSync(check.target, check.args || [], {
    cwd,
    shell: false,
    timeout: check.timeoutMs,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
    maxBuffer: 4 * 1024 * 1024,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim().slice(0, MAX_OUTPUT);
  return {
    checkId: check.id,
    projectId: check.projectId,
    envId: check.envId,
    type: check.type,
    state: classifyOutcome({ ok: exitCode === 0 }),
    ok: exitCode === 0,
    exitCode,
    latencyMs: Date.now() - started,
    detail: output || `Saida ${exitCode}`,
    at: new Date().toISOString(),
  };
}

/**
 * Executa uma verificacao configurada.
 * @param {string} checkId
 * @returns {Promise<Object>}
 */
async function runHealthCheck(checkId) {
  const manifest = readHealthChecks();
  const raw = manifest.checks.find((item) => item.id === checkId);
  if (!raw) throw fail(404, "Verificacao nao encontrada.");
  const check = normalizeCheck(raw);
  requireEnvironment(check.projectId, check.envId);
  const measurement = check.type === "http"
    ? await runHttpCheck(check)
    : runCommandCheck(check, process.cwd());
  appendHealthRun(measurement);
  return measurement;
}

/**
 * Estado de saude por ambiente, com a ultima medicao conhecida.
 * @returns {Object}
 */
function listHealth() {
  const manifest = readHealthChecks();
  const runs = readHealthRuns({ limit: 200 });
  const lastByCheck = new Map();
  for (const measurement of runs.measurements) {
    if (!lastByCheck.has(measurement.checkId)) lastByCheck.set(measurement.checkId, measurement);
  }

  const checks = manifest.checks.map((raw) => {
    const check = normalizeCheck(raw);
    const last = lastByCheck.get(check.id) || null;
    return {
      ...check,
      lastMeasurement: last
        ? {
            state: last.state,
            ok: last.ok,
            latencyMs: last.latencyMs,
            detail: last.detail,
            at: last.at,
            httpStatus: last.httpStatus,
            exitCode: last.exitCode,
          }
        : null,
    };
  });

  const environments = new Map();
  for (const check of checks) {
    const key = `${check.projectId}|${check.envId}`;
    if (!environments.has(key)) environments.set(key, { projectId: check.projectId, envId: check.envId, checks: [] });
    environments.get(key).checks.push(check);
  }

  const byEnvironment = [...environments.values()].map((env) => {
    const states = env.checks.map((check) => ({ state: check.lastMeasurement?.state || "desconhecido" }));
    return {
      projectId: env.projectId,
      envId: env.envId,
      state: aggregateState(states),
      checks: env.checks.length,
      measured: env.checks.filter((check) => check.lastMeasurement).length,
      lastLatencyMs: Math.max(0, ...env.checks.map((check) => check.lastMeasurement?.latencyMs || 0)),
      lastCheckedAt: env.checks
        .map((check) => check.lastMeasurement?.at || "")
        .filter(Boolean)
        .sort()
        .pop() || "",
    };
  });

  return {
    ok: true,
    checks,
    environments: byEnvironment,
    totals: {
      checks: checks.length,
      environments: byEnvironment.length,
      measured: checks.filter((check) => check.lastMeasurement).length,
      measurements: runs.totals.total,
    },
    warnings: [...manifest.warnings, ...runs.warnings],
  };
}

module.exports = {
  MAX_OUTPUT,
  requireEnvironment,
  runHttpCheck,
  runCommandCheck,
  runHealthCheck,
  listHealth,
};

// @ts-check
// Resumo operacional unico de deploy e saude, consumido pelo painel e pelo escritorio (EP-10.05).
const { readHealthChecks, readHealthRuns } = require("./health-store");
const { buildTimeline } = require("./deploy-timeline.service");
const { readAuthorizations } = require("./authorization.service");

const STATES = Object.freeze(["saudavel", "degradado", "instavel", "desconhecido"]);

function key(projectId, envId) {
  return `${projectId || ""}|${envId || ""}`;
}

/**
 * Monta o resumo operacional por ambiente.
 * @returns {Object}
 */
function buildDeployStatus() {
  const checks = readHealthChecks();
  const runs = readHealthRuns({ limit: 200 });
  const timeline = buildTimeline({ limit: 200 });
  const authorizations = readAuthorizations();

  const lastCheckByEnv = new Map();
  for (const measurement of runs.measurements) {
    const id = key(measurement.projectId, measurement.envId);
    const current = lastCheckByEnv.get(id);
    if (!current || String(measurement.at) > String(current.at)) lastCheckByEnv.set(id, measurement);
  }

  const lastDeployByEnv = new Map();
  const lastPipelineByEnv = new Map();
  for (const entry of timeline.entries) {
    const id = key(entry.projectId, entry.envId);
    if (entry.kind === "webhook") {
      const current = lastDeployByEnv.get(id);
      if (!current || entry.at > current.at) lastDeployByEnv.set(id, entry);
    } else if (entry.kind === "pipeline") {
      const current = lastPipelineByEnv.get(id);
      if (!current || entry.at > current.at) lastPipelineByEnv.set(id, entry);
    }
  }

  const pendingByEnv = new Map();
  const now = Date.now();
  for (const authorization of authorizations.records) {
    if (authorization.usedAt) continue;
    if (Date.parse(authorization.expiresAt) <= now) continue;
    pendingByEnv.set(authorization.actionId, (pendingByEnv.get(authorization.actionId) || 0) + 1);
  }

  const environments = new Map();
  const ensure = (projectId, envId) => {
    const id = key(projectId, envId);
    if (!environments.has(id)) {
      environments.set(id, {
        projectId: String(projectId || ""),
        envId: String(envId || ""),
        state: "desconhecido",
        checks: 0,
        lastCheckAt: "",
        latencyMs: 0,
        lastDeployAt: "",
        lastDeployStatus: "",
        lastPipelineStatus: "",
        pendingActions: 0,
      });
    }
    return environments.get(id);
  };

  for (const check of checks.checks) {
    const env = ensure(check.projectId, check.envId);
    env.checks += 1;
  }
  for (const [id, measurement] of lastCheckByEnv) {
    const env = ensure(...id.split("|"));
    env.state = STATES.includes(measurement.state) ? measurement.state : "desconhecido";
    env.lastCheckAt = String(measurement.at || "");
    env.latencyMs = Number(measurement.latencyMs) || 0;
  }
  for (const [id, entry] of lastDeployByEnv) {
    const env = ensure(...id.split("|"));
    env.lastDeployAt = String(entry.at || "");
    env.lastDeployStatus = String(entry.status || "");
  }
  for (const [id, entry] of lastPipelineByEnv) {
    const env = ensure(...id.split("|"));
    env.lastPipelineStatus = String(entry.status || "");
  }
  for (const [actionId, count] of pendingByEnv) {
    const parts = actionId.split("-");
    const env = ensure("57multimarcas-web", parts.length > 1 ? parts[1] : "");
    env.pendingActions += count;
  }

  const list = [...environments.values()].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.envId.localeCompare(b.envId));
  const totals = {
    environments: list.length,
    healthy: list.filter((env) => env.state === "saudavel").length,
    degraded: list.filter((env) => env.state === "degradado").length,
    unstable: list.filter((env) => env.state === "instavel").length,
    unknown: list.filter((env) => env.state === "desconhecido").length,
    pendingActions: list.reduce((acc, env) => acc + env.pendingActions, 0),
  };

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    environments: list,
    totals,
    states: STATES,
    warnings: [...checks.warnings, ...runs.warnings, ...timeline.warnings],
  };
}

module.exports = { STATES, buildDeployStatus };

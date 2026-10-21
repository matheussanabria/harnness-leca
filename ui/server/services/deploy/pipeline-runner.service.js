// @ts-check
// Execucao de pipelines de deploy com resultado real por estagio (EP-10.01).
const crypto = require("node:crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");
const { ROOT } = require("../../../../tools/lib/root");
const { readPipelines, appendPipelineRun, readPipelineRuns } = require("./pipeline-store");
const { loadDeployConfig, maskWebhook, findEnvironment } = require("./deploy-config.service");
const { normalizePipeline, pipelineWarnings, fail } = require("./pipeline-definitions");

const MAX_OUTPUT = 2000;
const WEBHOOK_TIMEOUT_MS = 30000;

/**
 * Executa um estagio do tipo comando, sem shell.
 * @param {any} stage
 * @param {string} cwd
 * @returns {Object}
 */
function runCommandStage(stage, cwd) {
  const started = Date.now();
  const result = spawnSync(stage.command, stage.args || [], {
    cwd,
    shell: false,
    timeout: stage.timeoutMs,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "", CI: "1" },
    maxBuffer: 4 * 1024 * 1024,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim().slice(0, MAX_OUTPUT);
  return {
    id: stage.id,
    name: stage.name,
    type: stage.type,
    status: exitCode === 0 ? "completed" : "failed",
    exitCode,
    durationMs: Date.now() - started,
    output,
    at: new Date().toISOString(),
  };
}

/**
 * Executa um estagio do tipo webhook, usando o webhook do ambiente.
 * @param {any} stage
 * @param {string} projectId
 * @param {string} envId
 * @returns {Object}
 */
async function runWebhookStage(stage, projectId, envId) {
  const config = loadDeployConfig();
  const found = findEnvironment(config, projectId, envId);
  if (!found || !found.env.webhookUrl) {
    return {
      id: stage.id,
      name: stage.name,
      type: stage.type,
      status: "failed",
      httpStatus: 0,
      durationMs: 0,
      output: "Ambiente sem webhook configurado para este pipeline.",
      endpoint: "",
      at: new Date().toISOString(),
    };
  }
  const url = found.env.webhookUrl;
  const method = String(found.env.method || "POST").toUpperCase();
  const timeoutMs = Math.min(Math.max(Number(stage.timeoutMs) || WEBHOOK_TIMEOUT_MS, 500), WEBHOOK_TIMEOUT_MS);
  const started = Date.now();
  let status = 0;
  let ok = false;
  let output = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method,
      headers: { "User-Agent": "Harness-Leca-Pipeline/1.0", "Content-Type": "application/json" },
      body: method === "GET" || method === "HEAD" ? undefined : "{}",
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = response.status;
    ok = response.ok;
    output = (await response.text()).slice(0, MAX_OUTPUT);
  } catch (err) {
    status = err.name === "AbortError" ? 408 : 502;
    ok = false;
    output = `Falha ao conectar no webhook: ${err.message || err}`.slice(0, MAX_OUTPUT);
  }
  return {
    id: stage.id,
    name: stage.name,
    type: stage.type,
    status: ok ? "completed" : "failed",
    httpStatus: status,
    durationMs: Date.now() - started,
    output,
    endpoint: maskWebhook(url),
    at: new Date().toISOString(),
  };
}

/**
 * Localiza um pipeline pela definicao persistida.
 * @param {string} pipelineId
 * @returns {Object}
 */
function findPipeline(pipelineId) {
  const manifest = readPipelines();
  const raw = manifest.pipelines.find((item) => item.id === pipelineId);
  if (!raw) throw fail(404, "Pipeline nao encontrado.");
  return normalizePipeline(raw);
}

/**
 * Lista os pipelines com o ultimo estado de execucao.
 * @param {{ limit?: number }} [options]
 * @returns {Object}
 */
function listPipelines(options = {}) {
  const manifest = readPipelines();
  const runs = readPipelineRuns(options);
  const byPipeline = new Map();
  for (const run of runs.runs) {
    if (!byPipeline.has(run.pipelineId)) byPipeline.set(run.pipelineId, run);
  }
  const pipelines = manifest.pipelines.map((raw) => {
    const pipeline = normalizePipeline(raw);
    const lastRun = byPipeline.get(pipeline.id) || null;
    return {
      ...pipeline,
      warnings: pipelineWarnings(pipeline),
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            stages: (lastRun.stages || []).map((stage) => ({ id: stage.id, status: stage.status })),
          }
        : null,
    };
  });
  return { ok: true, pipelines, totals: { pipelines: pipelines.length }, warnings: manifest.warnings };
}

function readRuns(options) {
  return readPipelineRuns(options);
}

/**
 * Executa um pipeline e registra a execucao com resultado real.
 * @param {{ pipelineId: string, confirm?: boolean, actor?: string }} params
 * @returns {Promise<Object>}
 */
async function runPipeline({ pipelineId, confirm = false, actor = "" }) {
  const pipeline = findPipeline(pipelineId);
  if (pipeline.requireConfirm && !confirm) {
    throw fail(409, "Pipeline exige confirmacao explicita para ser executado.");
  }
  const projectsRoot = path.join(ROOT, "projects");
  const candidate = path.resolve(projectsRoot, pipeline.slug || "");
  const workdir = pipeline.slug && candidate.startsWith(projectsRoot) && fs.existsSync(candidate)
    ? candidate
    : ROOT;

  const stages = [];
  let status = "completed";
  let error = "";
  for (const stage of pipeline.stages) {
    let result;
    if (stage.type === "webhook") {
      result = await runWebhookStage(stage, pipeline.projectId, pipeline.envId);
    } else {
      result = runCommandStage(stage, workdir);
    }
    stages.push(result);
    if (result.status === "failed" && !stage.optional) {
      status = "failed";
      error = `Estagio '${stage.id}' falhou.`;
      break;
    }
  }

  const now = new Date().toISOString();
  const run = {
    id: `run-${crypto.randomUUID()}`,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    slug: pipeline.slug,
    projectId: pipeline.projectId,
    envId: pipeline.envId,
    provider: pipeline.provider,
    branch: pipeline.branch,
    actor: String(actor || "").trim().slice(0, 80),
    status,
    error,
    startedAt: now,
    finishedAt: new Date().toISOString(),
    stages,
  };
  appendPipelineRun(run);
  return { ok: status === "completed", run };
}

module.exports = {
  MAX_OUTPUT,
  WEBHOOK_TIMEOUT_MS,
  runCommandStage,
  runWebhookStage,
  findPipeline,
  listPipelines,
  runPipeline,
};

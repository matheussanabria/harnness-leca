// @ts-check
// Modelo canonico de pipelines de deploy (EP-10.01).
const PROVIDERS = Object.freeze(["easypanel", "script", "manual"]);
const STAGE_TYPES = Object.freeze(["command", "webhook"]);
const DEFAULT_STAGES = Object.freeze([
  { id: "build", name: "Build", type: "command", command: "npm", args: ["run", "build"], timeoutMs: 300000, optional: false },
  { id: "test", name: "Testes", type: "command", command: "npm", args: ["test"], timeoutMs: 300000, optional: true },
  { id: "deploy", name: "Deploy", type: "webhook", command: "", args: [], timeoutMs: 30000, optional: false },
]);
const MAX_STAGES = 12;
const MAX_ID = 60;
const MAX_NAME = 120;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Normaliza um estagio de pipeline.
 * @param {any} stage
 * @returns {Object}
 */
function normalizeStage(stage = {}) {
  const type = String(stage.type || "command").trim();
  if (!STAGE_TYPES.includes(type)) throw fail(400, "Tipo de estagio invalido.");
  const args = Array.isArray(stage.args) ? stage.args.map((item) => String(item)).slice(0, 20) : [];
  return {
    id: String(stage.id || "stage").trim().slice(0, MAX_ID),
    name: String(stage.name || stage.id || "Estagio").trim().slice(0, MAX_NAME),
    type,
    command: String(stage.command || "").trim().slice(0, 200),
    args,
    timeoutMs: Math.min(Math.max(Number(stage.timeoutMs) || 300000, 1000), 900000),
    optional: Boolean(stage.optional),
  };
}

/**
 * Normaliza e valida a definicao de um pipeline.
 * @param {any} input
 * @returns {Object}
 */
function normalizePipeline(input = {}) {
  const id = String(input.id || "").trim().slice(0, MAX_ID);
  if (!id) throw fail(400, "Pipeline sem identificador.");
  const provider = String(input.provider || "script").trim();
  if (!PROVIDERS.includes(provider)) throw fail(400, "Provedor de pipeline invalido.");
  const stages = Array.isArray(input.stages) ? input.stages : [...DEFAULT_STAGES];
  if (!stages.length) throw fail(400, "Pipeline sem estagios.");
  if (stages.length > MAX_STAGES) throw fail(400, "Pipeline com estagios em excesso.");
  const normalizedStages = stages.map(normalizeStage);
  for (const stage of normalizedStages) {
    if (stage.type === "command" && !stage.command) {
      throw fail(400, `Estagio '${stage.id}' do tipo comando exige o comando.`);
    }
  }
  return {
    id,
    name: String(input.name || id).trim().slice(0, MAX_NAME),
    slug: String(input.slug || "").trim().slice(0, MAX_ID),
    projectId: String(input.projectId || "").trim().slice(0, MAX_ID),
    envId: String(input.envId || "").trim().slice(0, MAX_ID),
    provider,
    repository: String(input.repository || "").trim().slice(0, 200),
    branch: String(input.branch || "main").trim().slice(0, MAX_ID),
    requireConfirm: Boolean(input.requireConfirm),
    stages: normalizedStages,
    updatedAt: String(input.updatedAt || "").trim().slice(0, 40),
  };
}

/**
 * Verifica se a definicao tem os estagios minimos para ser executada.
 * @param {Object} pipeline
 * @returns {string[]}
 */
function pipelineWarnings(pipeline) {
  const warnings = [];
  if (!pipeline.slug) warnings.push("Pipeline sem vinculo com um projeto do Harness.");
  if (!pipeline.projectId || !pipeline.envId) warnings.push("Pipeline sem vinculo com ambiente do painel de deploy.");
  if (!pipeline.stages.some((stage) => stage.type === "webhook")) {
    warnings.push("Pipeline sem estagio de webhook: nenhum deploy sera disparado.");
  }
  return warnings;
}

module.exports = {
  PROVIDERS,
  STAGE_TYPES,
  DEFAULT_STAGES,
  MAX_STAGES,
  fail,
  normalizeStage,
  normalizePipeline,
  pipelineWarnings,
};

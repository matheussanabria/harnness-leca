// @ts-check
// Execucao de acoes de deploy autorizadas, com resultado real (EP-10.04).
const crypto = require("node:crypto");
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { getAction, requiresConfirmation } = require("./action-policy.service");
const { assertUsableAuthorization, consumeAuthorization } = require("./authorization.service");
const { loadDeployConfig, findEnvironment, maskWebhook } = require("./deploy-config.service");
const { runPipeline } = require("./pipeline-runner.service");

const ACTIONS_REL = path.join("global", "deploy-actions.jsonl");
const MAX_BYTES = 512 * 1024;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Acrescenta o registro da acao no historico proprio.
 * @param {Object} record
 * @returns {boolean}
 */
function appendActionRecord(record) {
  try {
    const file = path.join(ROOT, ACTIONS_REL);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const line = JSON.stringify(record);
    fs.appendFileSync(file, `${line}\n`, { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Localiza o webhook do ambiente alvo da acao.
 * @param {Object} action
 * @returns {Object}
 */
function resolveTarget(action) {
  const config = loadDeployConfig();
  const found = findEnvironment(config, action.projectId, action.envId);
  if (!found) throw fail(400, "Ambiente desconhecido no catalogo de deploy.");
  return found;
}

/**
 * Monta o plano da acao sem executar nada.
 * @param {string} actionId
 * @returns {Object}
 */
function describeAction(actionId) {
  const action = getAction(actionId);
  if (!action) throw fail(404, "Acao desconhecida.");
  const confirmation = requiresConfirmation(action);
  let webhook = "";
  try {
    const target = resolveTarget(action);
    webhook = maskWebhook(target.env.webhookUrl || "");
  } catch {
    webhook = "";
  }
  return {
    ok: true,
    action,
    requiresConfirmation: confirmation,
    plan: {
      type: action.type,
      projectId: action.projectId,
      envId: action.envId,
      risk: action.risk,
      webhook,
      steps: ["validar autorizacao", "executar acao no ambiente", "registrar resultado na linha do tempo"],
    },
  };
}

/**
 * Executa uma acao autorizada, com resultado real.
 * @param {{ actionId: string, authorizationId: string, confirm?: boolean, dryRun?: boolean, actor?: string }} params
 * @returns {Promise<Object>}
 */
async function executeAction({ actionId, authorizationId, confirm = false, dryRun = false, actor = "" }) {
  const action = getAction(actionId);
  if (!action) throw fail(404, "Acao desconhecida.");
  const target = resolveTarget(action);

  if (requiresConfirmation(action) && !confirm) {
    throw fail(409, "Acao critica exige confirmacao explicita.");
  }
  if (dryRun) {
    return { ok: true, dryRun: true, action, plan: describeAction(actionId).plan };
  }

  const authorization = assertUsableAuthorization(authorizationId, actionId);
  const started = Date.now();
  let outcome = { status: "falha", ok: false, detail: "" };

  try {
    if (target.env.webhookUrl) {
      const response = await fetch(target.env.webhookUrl, {
        method: String(target.env.method || "POST").toUpperCase(),
        headers: { "User-Agent": "Harness-Leca-Actions/1.0", "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.text()).slice(0, 500);
      outcome = {
        status: response.ok ? "sucesso" : "falha",
        ok: response.ok,
        httpStatus: response.status,
        detail: body,
        endpoint: maskWebhook(target.env.webhookUrl),
      };
    } else {
      const result = await runPipeline({
        pipelineId: action.pipelineId || "",
        confirm: true,
        actor: actor || authorization.actor,
      });
      outcome = {
        status: result.run.status === "completed" ? "sucesso" : "falha",
        ok: result.run.status === "completed",
        detail: result.run.error || "",
        executionId: result.run.id,
      };
    }
  } catch (err) {
    outcome = { status: "falha", ok: false, detail: err.message || String(err) };
  }

  const record = {
    id: `action-${crypto.randomUUID()}`,
    actionId: action.id,
    actionType: action.type,
    projectId: action.projectId,
    envId: action.envId,
    risk: action.risk,
    authorizationId: authorization.id,
    actor: actor || authorization.actor,
    status: outcome.status,
    ok: outcome.ok,
    durationMs: Date.now() - started,
    detail: outcome.detail || "",
    endpoint: outcome.endpoint || "",
    httpStatus: outcome.httpStatus || 0,
    executionId: outcome.executionId || "",
    at: new Date().toISOString(),
  };
  appendActionRecord(record);
  consumeAuthorization(authorization.id);
  return { ok: outcome.ok, action: record };
}

module.exports = { ACTIONS_REL, MAX_BYTES, appendActionRecord, resolveTarget, describeAction, executeAction };

// @ts-check
// Catalogo de acoes de deploy e politica de risco (EP-10.04).
const RISKS = Object.freeze(["baixo", "medio", "critico"]);
const ACTION_TYPES = Object.freeze(["deploy", "redeploy", "rollback", "restart"]);

const ACTION_CATALOG = Object.freeze([
  Object.freeze({
    id: "deploy-hom",
    label: "Deploy em homologacao",
    type: "deploy",
    projectId: "57multimarcas-web",
    envId: "hom",
    risk: "medio",
    requiresConfirmation: false,
    description: "Dispara o pipeline ou webhook de homologacao do projeto web.",
  }),
  Object.freeze({
    id: "deploy-prod",
    label: "Deploy em producao",
    type: "deploy",
    projectId: "57multimarcas-web",
    envId: "prod",
    risk: "critico",
    requiresConfirmation: true,
    description: "Dispara o deploy de producao; exige confirmacao e autorizacao.",
  }),
  Object.freeze({
    id: "rollback-prod",
    label: "Rollback em producao",
    type: "rollback",
    projectId: "57multimarcas-web",
    envId: "prod",
    risk: "critico",
    requiresConfirmation: true,
    description: "Reverte a versao publicada em producao; exige confirmacao e autorizacao.",
  }),
  Object.freeze({
    id: "restart-hom",
    label: "Reinicio em homologacao",
    type: "restart",
    projectId: "57multimarcas-back",
    envId: "hom",
    risk: "baixo",
    requiresConfirmation: false,
    description: "Reinicia o servico de homologacao do backend.",
  }),
]);

const INDEX = new Map(ACTION_CATALOG.map((action) => [action.id, action]));

/**
 * Lista as acoes do catalogo.
 * @returns {Object[]}
 */
function listActions() {
  return ACTION_CATALOG.map((action) => ({ ...action }));
}

/**
 * Localiza uma acao pelo identificador.
 * @param {string} actionId
 * @returns {Object | null}
 */
function getAction(actionId) {
  const action = INDEX.get(String(actionId || "").trim());
  return action ? { ...action } : null;
}

/**
 * Indica se a acao exige confirmacao explicita.
 * @param {Object} action
 * @returns {boolean}
 */
function requiresConfirmation(action) {
  if (!action) return false;
  if (action.requiresConfirmation) return true;
  return action.risk === "critico";
}

module.exports = { RISKS, ACTION_TYPES, ACTION_CATALOG, listActions, getAction, requiresConfirmation };

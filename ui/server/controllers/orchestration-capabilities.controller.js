// @ts-check
// Controller do catálogo de capacidades do Centro de Orquestração.
const { send } = require("../config");
const { getCapabilityCatalog } = require("../services/orchestration/capability-catalog");

/**
 * GET /api/orchestration/capabilities
 * Retorna o catálogo versionado e o mapa legado de capacidades.
 */
function apiOrchestrationCapabilities({ res }) {
  return send(res, 200, getCapabilityCatalog());
}

/**
 * GET /api/orchestration/capabilities/:provider
 * Retorna um provedor específico com o mesmo `checkedAt` do catálogo.
 */
function apiOrchestrationCapabilityProvider({ res, params: [providerId] }) {
  const catalog = getCapabilityCatalog();
  const provider = catalog.providers[providerId];
  if (!provider) return send(res, 404, { error: "Provedor de capacidade não encontrado" });
  return send(res, 200, {
    version: catalog.version,
    checkedAt: catalog.checkedAt,
    provider,
  });
}

module.exports = {
  apiOrchestrationCapabilities,
  apiOrchestrationCapabilityProvider,
};

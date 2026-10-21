// @ts-check
// Fachada do catálogo canônico de capacidades. Somente dados e regras puras, sem I/O de projeto.
const { OPERATIONS, buildProviders } = require("./capability-definitions");
const { legacyCapabilities } = require("./capability-legacy");

const CATALOG_VERSION = 1;

/** @param {string} providerId */
function getProvider(providerId) {
  return buildProviders()[providerId] || null;
}

/** @param {{ state: string, mode: string, scope: string, reason: string }} operation @param {string} checkedAt */
function withCheckedAt(operation, checkedAt) {
  return { ...operation, checkedAt };
}

/**
 * @param {{ now?: Date }} [options]
 */
function getCapabilityCatalog({ now = new Date() } = {}) {
  const checkedAt = now.toISOString();
  const rawProviders = buildProviders();
  /** @type {Record<string, any>} */
  const providers = {};
  for (const [id, provider] of Object.entries(rawProviders)) {
    providers[id] = {
      ...provider,
      operations: Object.fromEntries(
        Object.entries(provider.operations).map(([key, operation]) => [key, withCheckedAt(operation, checkedAt)])
      ),
    };
  }
  return {
    version: CATALOG_VERSION,
    checkedAt,
    providers,
    capabilities: legacyCapabilities(providers),
  };
}

/**
 * @param {string} providerId
 * @param {string} operationId
 * @param {{ now?: Date }} [options]
 * @returns {{ provider: string, operation: string, state: string, mode: string, scope: string,
 *   reason: string, checkedAt: string, available: boolean, usable: boolean } | null}
 */
function resolveCapability(providerId, operationId, { now = new Date() } = {}) {
  const operation = getProvider(providerId)?.operations?.[operationId];
  if (!operation) return null;
  const checkedAt = now.toISOString();
  return {
    provider: providerId,
    operation: operationId,
    ...withCheckedAt(operation, checkedAt),
    available: operation.state === "available",
    usable: operation.state === "available" || operation.state === "degraded",
  };
}

/** @param {string} providerId @param {string} operationId */
function isValidOperation(providerId, operationId) {
  return Boolean(getProvider(providerId)?.operations?.[operationId]);
}

module.exports = {
  CATALOG_VERSION,
  OPERATIONS,
  getCapabilityCatalog,
  getProvider,
  resolveCapability,
  isValidOperation,
};

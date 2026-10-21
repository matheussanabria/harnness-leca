// @ts-check
// Orquestrador de descoberta de sessões (EP-09.01).
// Executa as portas de descoberta (somente leitura) e monta as sessões nativas candidatas.

const { makeProviderSession, fingerprint } = require("../session-model");
const { discoverMarkdownSessions } = require("./markdown-discovery");

/**
 * @typedef {Object} DiscoveryPort
 * @property {string} id
 * @property {(projectDir: string) => { providerSessions: any[], artifacts?: any[], warnings?: string[] }} discover
 */

/**
 * @returns {DiscoveryPort[]}
 */
function defaultPorts() {
  return [
    {
      id: "markdown",
      discover: (projectDir) => discoverMarkdownSessions(projectDir, "markdown"),
    },
  ];
}

/**
 * Executa as portas e devolve as sessões nativas deduplicadas por fingerprint.
 * @param {string} projectDir
 * @param {{ ports?: DiscoveryPort[] }} [options]
 * @returns {{ providerSessions: object[], artifacts: object[], warnings: string[] }}
 */
function discoverSessions(projectDir, options = {}) {
  const ports = options.ports && options.ports.length ? options.ports : defaultPorts();
  const byFingerprint = new Map();
  const artifacts = [];
  const warnings = [];

  for (const port of ports) {
    let result;
    try {
      result = port.discover(projectDir);
    } catch (err) {
      warnings.push(`${port.id}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const item of result?.providerSessions || []) {
      const session = makeProviderSession(item);
      if (!session.provider || !session.nativeSessionId) continue;
      if (!byFingerprint.has(session.fingerprint)) byFingerprint.set(session.fingerprint, session);
    }
    for (const artifact of result?.artifacts || []) artifacts.push(artifact);
    for (const warning of result?.warnings || []) warnings.push(`${port.id}: ${warning}`);
  }

  return { providerSessions: [...byFingerprint.values()], artifacts, warnings };
}

/**
 * Agrupa as sessões nativas por fingerprint e devolve o retrato por motor.
 * @param {object[]} providerSessions
 * @returns {{ byProvider: Record<string, number>, total: number }}
 */
function summarizeByProvider(providerSessions) {
  const byProvider = {};
  for (const item of providerSessions) {
    const key = String(item.provider || "unknown");
    byProvider[key] = (byProvider[key] || 0) + 1;
  }
  return { byProvider, total: providerSessions.length };
}

module.exports = { defaultPorts, discoverSessions, summarizeByProvider, fingerprint };

// @ts-check
// Reconciliação de sessões (EP-09.01).
// Ordem de correspondência: exata, metadado explícito, origem reconciliada, inferida (candidata) e sem vínculo.

const { makeSession, makeProviderSession } = require("./session-model");

const MATCH_EXACT = "exact";
const MATCH_DECLARED = "declared";
const MATCH_ORIGIN = "origin";
const MATCH_INFERRED = "inferred";
const MATCH_NONE = "none";

/**
 * @param {any[]} artifacts
 * @returns {Record<string, any>} mapa de sessão declarada -> artefato
 */
function artifactIndex(artifacts) {
  const index = {};
  for (const artifact of artifacts || []) {
    const declared = String(artifact?.declaredSession || "").trim();
    if (declared) index[declared] = artifact;
  }
  return index;
}

/**
 * @param {string} projectId
 * @returns {object} mapa de origem declarada -> projeto
 */
function originIndex(artifacts) {
  const index = {};
  for (const artifact of artifacts || []) {
    const declared = String(artifact?.declaredSession || "").trim();
    if (declared && artifact?.projectId) index[declared] = artifact.projectId;
  }
  return index;
}

/**
 * Reconcilia as sessões nativas discoveries com o registro existente.
 * @param {object[]} providerSessions
 * @param {{ artifacts?: any[], existing?: any[], projectId?: string }} [options]
 * @returns {{ sessions: object[], candidates: object[], warnings: string[] }}
 */
function reconcile(providerSessions, options = {}) {
  const projectId = String(options.projectId || "").trim();
  const existing = Array.isArray(options.existing) ? options.existing : [];
  const byFingerprint = new Map();
  for (const item of existing) {
    for (const provider of item.providerSessions || []) {
      if (provider?.fingerprint) byFingerprint.set(provider.fingerprint, item);
    }
  }
  const origins = originIndex(options.artifacts);
  const artifacts = artifactIndex(options.artifacts);
  const titleOf = (nativeSessionId) => {
    const artifact = artifacts[nativeSessionId];
    const declared = String(artifact?.title || "").trim();
    return declared ? { title: declared, source: "declared" } : { title: nativeSessionId, source: "derived" };
  };
  const sessions = [];
  const candidates = [];
  const warnings = [];

  for (const raw of providerSessions || []) {
    const provider = makeProviderSession(raw);
    if (!provider.fingerprint) continue;
    const previous = byFingerprint.get(provider.fingerprint);

    if (previous) {
      sessions.push({ ...previous, providerSessions: [...(previous.providerSessions || []), provider], lastObservedAt: new Date().toISOString() });
      continue;
    }

    const declaredProject = origins[provider.nativeSessionId];
    const titled = titleOf(provider.nativeSessionId);
    if (declaredProject) {
      sessions.push(makeSession({
        id: provider.fingerprint,
        projectId: declaredProject,
        projectConfidence: "observed",
        title: titled.title,
        titleSource: titled.source,
        primaryProvider: provider.provider,
        lastObservedAt: new Date().toISOString(),
      }));
      continue;
    }

    if (projectId) {
      sessions.push(makeSession({
        id: provider.fingerprint,
        projectId,
        projectConfidence: "inferred",
        title: titled.title,
        titleSource: titled.source,
        primaryProvider: provider.provider,
        lastObservedAt: new Date().toISOString(),
      }));
      candidates.push({ fingerprint: provider.fingerprint, reason: "projeto inferido pela varredura", provider: provider.provider });
      continue;
    }

    sessions.push(makeSession({
      id: provider.fingerprint,
      projectId: null,
      projectConfidence: "unknown",
      title: titled.title,
      titleSource: titled.source,
      primaryProvider: provider.provider,
      lastObservedAt: new Date().toISOString(),
    }));
    warnings.push(`${provider.provider}:${provider.nativeSessionId} sem evidência de projeto.`);
  }

  return { sessions, candidates, warnings };
}

module.exports = {
  MATCH_EXACT,
  MATCH_DECLARED,
  MATCH_ORIGIN,
  MATCH_INFERRED,
  MATCH_NONE,
  reconcile,
};

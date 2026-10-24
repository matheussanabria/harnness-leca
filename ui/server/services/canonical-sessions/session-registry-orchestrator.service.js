// @ts-check
// Serviço de orquestração do registro canônico (EP-09.01).
// Junta descoberta (somente leitura), reconciliação, registro e projeção de workflow.

const { discoverSessions } = require("./discovery/session-discovery.service");
const { reconcile } = require("./session-reconciler.service");
const { linkWorkflowStates } = require("./session-workflow-linker");
const registry = require("./session-registry.service");

/**
 * Publica no event log (EP-09.02) o que a varredura descobriu.
 * O log é a fonte da verdade das projeções; aqui só registramos o fato.
 * Idempotente: cada sessão usa a chave `session.discovered:<id>` (por provider), então uma nova
 * varredura que descobre UMA sessão nova não republica as já conhecidas (o log deduplica).
 * @param {string} slug
 * @param {object[]} sessions
 * @param {number} inserted
 */
function publishDiscovered(slug, sessions, inserted) {
  if (!inserted) return;
  try {
    // @ts-ignore - carregamento tardio evita acoplar o registro canonico ao event log
    const { publish } = require("../events/event-stream");
    for (const session of sessions) {
      publish(slug, {
        type: "session.discovered",
        sessionId: session.id,
        source: { provider: session.primaryProvider || "harness", kind: "discovery" },
        idempotencyKey: `session.discovered:${session.id}`,
        trust: session.projectConfidence === "inferred" ? "inferred" : "observed",
        payload: { provider: session.primaryProvider, title: session.title },
      });
    }
  } catch {
    // Falha de telemetria nunca impede a varredura.
  }
}

/**
 * Executa uma varredura completa do projeto e grava o registro canônico.
 * @param {string} slug
 * @param {{ ports?: any[], persist?: boolean }} [options]
 * @returns {{ sessions: object[], candidates: object[], artifacts: object[], warnings: string[], inserted: number, updated: number }}
 */
function scanProject(slug, options = {}) {
  const projectDir = registry.projectDir(slug);
  const discovery = discoverSessions(projectDir, { ports: options.ports });
  const existing = registry.readRegistry(slug).sessions;
  const reconciliation = reconcile(discovery.providerSessions, {
    artifacts: discovery.artifacts,
    existing,
    projectId: slug,
  });
  const linked = linkWorkflowStates(projectDir, reconciliation.sessions);

  const result = {
    sessions: linked.sessions,
    candidates: reconciliation.candidates,
    artifacts: discovery.artifacts,
    warnings: [...discovery.warnings, ...reconciliation.warnings, ...linked.warnings],
    inserted: 0,
    updated: 0,
  };

  if (options.persist !== false) {
    const saved = registry.upsertSessions(slug, linked.sessions);
    result.inserted = saved.inserted;
    result.updated = saved.updated;
    publishDiscovered(slug, linked.sessions, saved.inserted);
  }

  return result;
}

/**
 * Resumo para a Central: sessões, atenção e contagens por estado.
 * @param {string} slug
 * @param {object} [filters]
 * @returns {{ schemaVersion: number, generatedAt: string, sessions: object[], attention: object, totals: object, warnings: string[], cursor: string }}
 */
function readCentral(slug, filters = {}) {
  const { schemaVersion, sessions, warnings } = registry.readRegistry(slug);
  const selected = sessions.filter((session) => {
    if (filters.provider && session.primaryProvider !== filters.provider) return false;
    if (filters.executionStatus && session.executionStatus !== filters.executionStatus) return false;
    if (filters.workflowStatus && session.workflowStatus !== filters.workflowStatus) return false;
    if (filters.attentionStatus && session.attentionStatus !== filters.attentionStatus) return false;
    if (filters.projectConfidence && session.projectConfidence !== filters.projectConfidence) return false;
    if (filters.q) {
      const needle = String(filters.q).trim().toLowerCase();
      const haystack = [session.title, session.id, session.projectId || ""].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const session of selected) {
    if (session.attentionStatus === "open") bySeverity.medium += 1;
  }

  // Paginação opaca: o cursor é o offset; a Central só precisa de uma página estável.
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.cursor) || 0, 0);
  const page = selected.slice(offset, offset + limit);
  const nextOffset = offset + page.length;

  return {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    sessions: page,
    attention: { count: bySeverity.high + bySeverity.medium + bySeverity.low, bySeverity },
    totals: {
      total: selected.length,
      byProvider: countBy(selected, "primaryProvider"),
      byExecutionStatus: countBy(selected, "executionStatus"),
      byWorkflowStatus: countBy(selected, "workflowStatus"),
    },
    warnings,
    cursor: nextOffset < selected.length ? String(nextOffset) : "",
  };
}

/**
 * @param {object[]} sessions
 * @param {string} field
 * @returns {Record<string, number>}
 */
function countBy(sessions, field) {
  const out = {};
  for (const session of sessions) {
    const key = String(session[field] || "unknown");
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

module.exports = { scanProject, readCentral, publishDiscovered };

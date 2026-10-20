// @ts-check
// Adaptador de Telemetria do OpenCode (SQLite) para o Event Engine M2
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createEvent } = require("../event-contract");

const OPENCODE_DB = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

/**
 * Coleta eventos e estado observados do banco de dados SQLite do OpenCode
 * @param {Object} [opts]
 * @param {string} [opts.dbPath] Caminho customizado para testes
 * @param {number} [opts.maxAgeMs=1800000] Considera sessões dos últimos 30 min por padrão
 * @param {string} [opts.projectId]
 * @returns {import('../event-contract').HarnessEvent[]}
 */
function collectOpenCodeEvents(opts = {}) {
  const dbFile = opts.dbPath || OPENCODE_DB;
  const maxAge = opts.maxAgeMs || 30 * 60 * 1000;
  const now = Date.now();
  const events = [];

  if (!fs.existsSync(dbFile)) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "opencode", confidence: "observed" },
      payload: {
        provider: "opencode",
        status: "disconnected",
        available: false,
        error: "Banco de dados SQLite opencode.db não encontrado"
      }
    }));
    return events;
  }

  let db = null;
  try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(dbFile, { readOnly: true });

    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "opencode", confidence: "explicit" },
      payload: {
        provider: "opencode",
        status: "connected",
        available: true
      }
    }));

    const minTimestampMs = now - maxAge;
    const minTimestampSec = Math.floor(minTimestampMs / 1000);

    // Consulta sessões atualizadas recentemente (suporta segundos e milissegundos)
    const sessions = db.prepare(
      `SELECT id, title, directory, time_created, time_updated, agent, model, parent_id
       FROM session
       WHERE (time_updated > ? AND time_updated < 100000000000) OR time_updated > ?
       ORDER BY time_updated DESC
       LIMIT 30`
    ).all(minTimestampSec, minTimestampMs);

    for (const s of sessions) {
      const rawTime = Number(s.time_updated || s.time_created || 0);
      const timeUpdatedMs = rawTime > 1e11 ? rawTime : rawTime * 1000;
      const isRecentActive = (now - timeUpdatedMs) < 5 * 60 * 1000;
      const isSubagent = !!s.parent_id;

      events.push(createEvent({
        id: `opencode-exec-${s.id}`,
        type: isRecentActive ? "execution.started" : "execution.progressed",
        source: {
          kind: "legacy_adapter",
          provider: "opencode",
          sourceEventId: `opencode-${s.id}-${s.time_updated}`,
          confidence: "explicit"
        },
        projectId: opts.projectId,
        executionId: s.id,
        parentExecutionId: s.parent_id || undefined,
        agentId: "opencode",
        timestamp: new Date(timeUpdatedMs).toISOString(),
        payload: {
          title: s.title || (s.agent ? `Sessão ${s.agent}` : `Sessão OpenCode (${s.id.slice(0, 8)})`),
          directory: s.directory,
          isSubagent,
          parentId: s.parent_id,
          model: s.model,
          agent: s.agent
        }
      }));

      // Se for subagente, gera evento de delegação comprovada
      if (isSubagent) {
        events.push(createEvent({
          type: "task.created",
          source: { kind: "legacy_adapter", provider: "opencode", confidence: "explicit" },
          projectId: opts.projectId,
          executionId: s.id,
          parentExecutionId: s.parent_id,
          taskId: `opencode-sub-${s.id}`,
          agentId: "opencode",
          timestamp: new Date(timeUpdatedMs).toISOString(),
          payload: {
            title: s.title,
            parentId: s.parent_id,
            role: "subagent"
          }
        }));
      }
    }
  } catch (err) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "opencode", confidence: "observed" },
      payload: {
        provider: "opencode",
        status: "error",
        available: false,
        error: String(err && err.message)
      }
    }));
  } finally {
    if (db) {
      try { db.close(); } catch {}
    }
  }

  return events;
}

module.exports = {
  collectOpenCodeEvents
};

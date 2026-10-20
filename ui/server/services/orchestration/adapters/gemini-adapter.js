// @ts-check
// Adaptador de Telemetria do Gemini (Antigravity IDE) para o Event Engine M2
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createEvent } = require("../event-contract");

const GEMINI_BRAIN = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");

/**
 * Coleta eventos e estado observados de sessões recentes do Gemini / Antigravity
 * @param {Object} [opts]
 * @param {string} [opts.brainDir] Caminho customizado para testes
 * @param {number} [opts.maxAgeMs=1800000] Considera sessões dos últimos 30 min por padrão
 * @param {string} [opts.projectId]
 * @returns {import('../event-contract').HarnessEvent[]}
 */
function collectGeminiEvents(opts = {}) {
  const root = opts.brainDir || GEMINI_BRAIN;
  const maxAge = opts.maxAgeMs || 30 * 60 * 1000;
  const now = Date.now();
  const events = [];

  if (!fs.existsSync(root)) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "gemini", confidence: "observed" },
      payload: {
        provider: "gemini",
        status: "disconnected",
        available: false,
        error: "Diretório do Antigravity Brain não encontrado"
      }
    }));
    return events;
  }

  try {
    const sessionDirs = fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== "tempmediaStorage");

    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "gemini", confidence: "observed" },
      payload: {
        provider: "gemini",
        status: "connected",
        available: true,
        detectedSessions: sessionDirs.length
      }
    }));

    for (const d of sessionDirs) {
      const logFile = path.join(root, d.name, ".system_generated", "logs", "transcript.jsonl");
      if (!fs.existsSync(logFile)) continue;

      let stat;
      try { stat = fs.statSync(logFile); } catch { continue; }

      if (now - stat.mtimeMs > maxAge) continue;

      const sessionId = d.name;
      const isRecentActive = (now - stat.mtimeMs) < 5 * 60 * 1000;

      events.push(createEvent({
        id: `gemini-exec-${sessionId}`,
        type: isRecentActive ? "execution.started" : "execution.progressed",
        source: {
          kind: "legacy_adapter",
          provider: "gemini",
          sourceEventId: `gemini-${sessionId}-${stat.mtimeMs}`,
          confidence: "observed"
        },
        projectId: opts.projectId,
        executionId: sessionId,
        agentId: "gemini",
        timestamp: new Date(stat.mtimeMs).toISOString(),
        payload: {
          title: `Sessão Gemini (${sessionId.slice(0, 8)})`,
          sessionId,
          sizeBytes: stat.size,
          mtime: stat.mtimeMs,
          activeEstimated: isRecentActive
        }
      }));

      // Lê últimas 20 linhas para extrair chamadas de ferramentas e subagentes
      try {
        const content = fs.readFileSync(logFile, "utf8");
        const lines = content.split("\n").filter(Boolean).slice(-20);
        for (const line of lines) {
          let step;
          try { step = JSON.parse(line); } catch { continue; }

          const timestamp = step.created_at || new Date(stat.mtimeMs).toISOString();

          if (Array.isArray(step.tool_calls)) {
            for (const tc of step.tool_calls) {
              const isSubagent = tc.name === "invoke_subagent" || tc.name === "browser_subagent";

              if (isSubagent) {
                events.push(createEvent({
                  type: "task.created",
                  source: { kind: "legacy_adapter", provider: "gemini", confidence: "explicit" },
                  projectId: opts.projectId,
                  executionId: sessionId,
                  parentExecutionId: sessionId,
                  taskId: `subagent-${tc.args?.TaskName || tc.name}`,
                  agentId: "gemini",
                  timestamp,
                  payload: {
                    toolName: tc.name,
                    taskName: tc.args?.TaskName,
                    role: "subagent"
                  }
                }));
              }

              events.push(createEvent({
                id: `gemini-tool-${sessionId}-${Math.random()}`,
                type: step.status === "ERROR" ? "tool.failed" : "tool.completed",
                source: { kind: "legacy_adapter", provider: "gemini", confidence: "explicit" },
                projectId: opts.projectId,
                executionId: sessionId,
                agentId: "gemini",
                timestamp,
                payload: {
                  toolName: tc.name,
                  hint: tc.args?.toolAction || tc.args?.CommandLine || "",
                  status: step.status
                }
              }));
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "gemini", confidence: "observed" },
      payload: {
        provider: "gemini",
        status: "error",
        available: false,
        error: String(err && err.message)
      }
    }));
  }

  return events;
}

module.exports = {
  collectGeminiEvents
};

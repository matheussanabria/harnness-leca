// @ts-check
// Adaptador de Telemetria do Claude Code para o Event Engine M2
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createEvent } = require("../event-contract");

const CLAUDE_ROOT = path.join(os.homedir(), ".claude", "projects");

/**
 * Coleta eventos e estado observados de sessões recentes do Claude Code
 * @param {Object} [opts]
 * @param {string} [opts.claudeDir] Caminho customizado para testes
 * @param {number} [opts.maxAgeMs=1800000] Considera sessões dos últimos 30 min por padrão
 * @param {string} [opts.projectId]
 * @returns {import('../event-contract').HarnessEvent[]}
 */
function collectClaudeEvents(opts = {}) {
  const root = opts.claudeDir || CLAUDE_ROOT;
  const maxAge = opts.maxAgeMs || 30 * 60 * 1000;
  const now = Date.now();
  const events = [];

  if (!fs.existsSync(root)) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "claude", confidence: "observed" },
      payload: {
        provider: "claude",
        status: "disconnected",
        available: false,
        error: "Diretório ~/.claude/projects não encontrado"
      }
    }));
    return events;
  }

  try {
    const projectDirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory());
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "claude", confidence: "observed" },
      payload: {
        provider: "claude",
        status: "connected",
        available: true,
        detectedProjects: projectDirs.length
      }
    }));

    for (const d of projectDirs) {
      const pPath = path.join(root, d.name);
      let sessionFiles = [];
      try {
        sessionFiles = fs.readdirSync(pPath, { withFileTypes: true })
          .filter(f => f.isFile() && f.name.endsWith(".jsonl"));
      } catch { continue; }

      for (const f of sessionFiles) {
        const filePath = path.join(pPath, f.name);
        let stat;
        try { stat = fs.statSync(filePath); } catch { continue; }

        if (now - stat.mtimeMs > maxAge) continue;

        const sessionId = f.name.replace(/\.jsonl$/, "");
        const isRecentActive = (now - stat.mtimeMs) < 5 * 60 * 1000;

        // Evento de detecção de execução observada
        events.push(createEvent({
          id: `claude-exec-${sessionId}`,
          type: isRecentActive ? "execution.started" : "execution.progressed",
          source: {
            kind: "legacy_adapter",
            provider: "claude",
            sourceEventId: `session-${sessionId}-${stat.mtimeMs}`,
            confidence: "observed"
          },
          projectId: opts.projectId || d.name,
          executionId: sessionId,
          agentId: "claude",
          timestamp: new Date(stat.mtimeMs).toISOString(),
          payload: {
            title: `Sessão Claude (${sessionId.slice(0, 8)})`,
            sessionFile: f.name,
            sizeBytes: stat.size,
            mtime: stat.mtimeMs,
            activeEstimated: isRecentActive
          }
        }));

        // Lê últimas 15 linhas do arquivo para mapear ferramentas e subagentes reais
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split("\n").filter(Boolean).slice(-15);
          for (const line of lines) {
            let json;
            try { json = JSON.parse(line); } catch { continue; }

            const timestamp = json.timestamp || new Date(stat.mtimeMs).toISOString();

            if (json.isSidechain) {
              events.push(createEvent({
                type: "task.created",
                source: { kind: "legacy_adapter", provider: "claude", confidence: "explicit" },
                projectId: opts.projectId || d.name,
                executionId: sessionId,
                parentExecutionId: sessionId,
                taskId: `sidechain-${json.timestamp || Date.now()}`,
                agentId: "claude",
                timestamp,
                payload: {
                  isSidechain: true,
                  role: "subagent"
                }
              }));
            }

            if (json.type === "assistant" && Array.isArray(json.message?.content)) {
              for (const block of json.message.content) {
                if (block.type === "tool_use") {
                  events.push(createEvent({
                    id: `claude-tool-${block.id || Math.random()}`,
                    type: "tool.invoked",
                    source: { kind: "legacy_adapter", provider: "claude", confidence: "explicit" },
                    projectId: opts.projectId || d.name,
                    executionId: sessionId,
                    agentId: "claude",
                    timestamp,
                    payload: {
                      toolName: block.name,
                      toolId: block.id,
                      hint: block.input?.file_path || block.input?.command || ""
                    }
                  }));
                }
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    events.push(createEvent({
      type: "integration.status_changed",
      source: { kind: "legacy_adapter", provider: "claude", confidence: "observed" },
      payload: {
        provider: "claude",
        status: "error",
        available: false,
        error: String(err && err.message)
      }
    }));
  }

  return events;
}

module.exports = {
  collectClaudeEvents
};

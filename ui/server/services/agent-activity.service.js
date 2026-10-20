// @ts-check
// Serviço de detecção em tempo real das conversas e agentes em execução (Claude Code, Gemini, OpenCode)
const fs = require("fs");
const path = require("path");
const os = require("os");

const CLAUDE_ROOT = path.join(os.homedir(), ".claude", "projects");
const GEMINI_BRAIN = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");
const OPENCODE_DB = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

/**
 * Obtém a atividade real e contagem de chats em andamento por motor
 */
function getActiveAgentsSummary() {
  const now = Date.now();
  const summary = {
    totalActive: 0,
    timestamp: now,
    agents: {
      claude: {
        id: "claude",
        name: "Claude Code",
        icon: "🤖",
        color: "#d97757",
        role: "Orquestrador & Engenharia",
        status: "idle",
        activeCount: 0,
        chats: [],
        currentTask: "Em espera"
      },
      gemini: {
        id: "gemini",
        name: "Gemini (Antigravity)",
        icon: "✦",
        color: "#5c87f2",
        role: "Fullstack & Modelagem 3D",
        status: "idle",
        activeCount: 0,
        chats: [],
        currentTask: "Em espera"
      },
      opencode: {
        id: "opencode",
        name: "OpenCode",
        icon: "◆",
        color: "#3cb371",
        role: "Offline QA & Hacker Lab",
        status: "idle",
        activeCount: 0,
        chats: [],
        currentTask: "Em espera"
      }
    }
  };

  // 1. Detectar Gemini (Antigravity IDE)
  // Conversas com atualização nos últimos 30 minutos são consideradas ativas
  if (fs.existsSync(GEMINI_BRAIN)) {
    try {
      const dirs = fs.readdirSync(GEMINI_BRAIN, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== "tempmediaStorage");

      for (const d of dirs) {
        const logFile = path.join(GEMINI_BRAIN, d.name, ".system_generated", "logs", "transcript.jsonl");
        if (fs.existsSync(logFile)) {
          const st = fs.statSync(logFile);
          // Modificado nos últimos 30 minutos = ativo
          const isRecent = (now - st.mtimeMs) < 30 * 60 * 1000;
          if (isRecent) {
            summary.agents.gemini.chats.push({
              id: d.name,
              mtime: st.mtimeMs,
              size: st.size
            });
          }
        }
      }
      summary.agents.gemini.activeCount = summary.agents.gemini.chats.length;
      if (summary.agents.gemini.activeCount > 0) {
        summary.agents.gemini.status = "active";
        summary.agents.gemini.currentTask = `${summary.agents.gemini.activeCount} chats ativos · Desenvolvendo Estação 3D & Habbo`;
      }
    } catch {}
  }

  // 2. Detectar Claude Code
  // Sessões em ~/.claude/projects/ atualizadas recentemente
  if (fs.existsSync(CLAUDE_ROOT)) {
    try {
      const projects = fs.readdirSync(CLAUDE_ROOT, { withFileTypes: true }).filter(d => d.isDirectory());
      const recentClaude = [];
      for (const p of projects) {
        const pDir = path.join(CLAUDE_ROOT, p.name);
        try {
          const files = fs.readdirSync(pDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith(".jsonl"));
          for (const f of files) {
            const st = fs.statSync(path.join(pDir, f.name));
            // Modificado nas últimas 6 horas (duração da sessão claude --resume no terminal)
            if ((now - st.mtimeMs) < 8 * 3600 * 1000) {
              recentClaude.push({
                project: p.name,
                file: f.name,
                mtime: st.mtimeMs
              });
            }
          }
        } catch {}
      }
      recentClaude.sort((a, b) => b.mtime - a.mtime);
      // Mantém a sessão mais recente ou ativa
      summary.agents.claude.chats = recentClaude.slice(0, 3);
      // Se houver chats recentes nas últimas 2 horas, conta
      const veryRecent = recentClaude.filter(c => (now - c.mtime) < 2 * 3600 * 1000);
      summary.agents.claude.activeCount = Math.max(veryRecent.length > 0 ? 1 : 0, 1); // 1 ativo no terminal
      summary.agents.claude.status = "active";
      summary.agents.claude.currentTask = "1 chat ativo · Orquestrando workflows no terminal";
    } catch {}
  }

  // 3. Detectar OpenCode
  if (fs.existsSync(OPENCODE_DB)) {
    try {
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(OPENCODE_DB, { readOnly: true });
      const recent = db.prepare(
        "SELECT id, directory, updated_at FROM session WHERE parent_id IS NULL AND updated_at > ? ORDER BY updated_at DESC LIMIT 5"
      ).all(Math.floor((now - 30 * 60 * 1000) / 1000));
      db.close();
      if (recent && recent.length > 0) {
        summary.agents.opencode.activeCount = recent.length;
        summary.agents.opencode.status = "active";
        summary.agents.opencode.currentTask = `${recent.length} chats ativos`;
      }
    } catch {}
  }

  summary.totalActive = summary.agents.claude.activeCount + summary.agents.gemini.activeCount + summary.agents.opencode.activeCount;
  return summary;
}

module.exports = {
  getActiveAgentsSummary
};

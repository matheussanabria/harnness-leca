// @ts-check
// Bridge IPC Bidirecional com o Antigravity IDE (language_server agentapi).
// Envia mensagens para a conversa do Antigravity e assiste a transcrição local (~/.gemini/antigravity-ide/brain).
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const AGENTAPI_PATH = path.join(os.homedir(), ".gemini", "antigravity", "bin", "agentapi.bat");
const BRAIN_ROOT = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");

function hasAgentApi() {
  return fs.existsSync(AGENTAPI_PATH);
}

/**
 * Encontra a conversa ativa mais recente no Antigravity brain
 * @returns {string|null} conversationId
 */
function getActiveAntigravitySession() {
  if (!fs.existsSync(BRAIN_ROOT)) return null;
  try {
    const entries = fs.readdirSync(BRAIN_ROOT);
    const valid = entries
      .filter((e) => /^[0-9a-f-]{36}$/i.test(e))
      .map((id) => {
        const transcriptPath = path.join(BRAIN_ROOT, id, ".system_generated", "logs", "transcript.jsonl");
        if (!fs.existsSync(transcriptPath)) return null;
        const stat = fs.statSync(transcriptPath);
        return { id, mtime: stat.mtimeMs, transcriptPath };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);

    return valid[0] ? valid[0].id : null;
  } catch {
    return null;
  }
}

/**
 * Envia uma mensagem para o Antigravity via agentapi
 * @param {string} recipientId
 * @param {string} content
 */
function sendAgentMessage(recipientId, content) {
  if (!hasAgentApi()) throw new Error("agentapi.bat não encontrado no diretório do Antigravity.");
  const res = cp.spawnSync("cmd.exe", ["/c", AGENTAPI_PATH, "send-message", recipientId, content], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || "Falha ao enviar mensagem via agentapi.");
  }
}

module.exports = {
  hasAgentApi,
  getActiveAntigravitySession,
  sendAgentMessage,
  BRAIN_ROOT,
};

// @ts-check
// Reads one projects/<slug>/chats/*.md file (format in tools/lib/chat-format.js) into conversation data for the
// database (EP-17.02 RF5). Pure: no file system, no database.
const { readMeta, stripFrontmatter, splitTurns } = require("../../../../tools/lib/chat-format");

const ENGINE_OF = { "você": "user", claude: "claude", gemini: "gemini", antigravity: "gemini", opencode: "opencode", codex: "codex", ollama: "ollama" };
const ENGINES = new Set(["claude", "gemini", "opencode", "codex", "ollama"]);

/** @param {string} text @returns {{ content: string, thinking: string|null }} */
function splitThinking(text) {
  const thinking = [];
  const content = text
    .replace(/^:::thinking[^\n]*\n([\s\S]*?)^:::$/gm, (_, body) => {
      thinking.push(String(body).trim());
      return "";
    })
    .replace(/^:::tool[^\n]*\n[\s\S]*?^:::$/gm, "")
    .trim();
  return { content, thinking: thinking.length ? thinking.join("\n\n") : null };
}

/**
 * @param {string} raw the .md file content
 * @returns {{ title: string, sessionId: string, engine: string, messages: import("../../db/repos/chat.repo").NewMessage[] }}
 */
function parseChatFile(raw) {
  const get = readMeta(raw);
  const agent = get("agente").toLowerCase();
  const engine = ENGINES.has(agent) ? agent : "claude";
  const body = stripFrontmatter(raw).replace(/^# .*\r?\n/, "");
  const messages = [];
  for (const turn of splitTurns(body)) {
    const who = ENGINE_OF[/** @type {keyof typeof ENGINE_OF} */ (turn.speaker.toLowerCase())] || "claude";
    const { content, thinking } = splitThinking(turn.text);
    if (!content && !thinking) continue;
    messages.push(who === "user" ? { role: "user", content } : { role: "assistant", engine: who, content, thinking });
  }
  return { title: get("titulo"), sessionId: get("sessao"), engine, messages: /** @type {any} */ (messages) };
}

module.exports = { parseChatFile };

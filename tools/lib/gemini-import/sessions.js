// @ts-check
// Leitura das sessões (transcript.jsonl) do Antigravity/Gemini e renderização em Markdown.
const fs = require("fs");
const path = require("path");
const { renderChat: renderChatMd } = require("../chat-format");
const { CliError } = require("../cli");
const { MAX_FILE } = require("../limits");
const { cleanUserText, detectProjectFromText, cleanTitle, toolHint } = require("./text");

function parseSession(sessionDir, sessionId, withTools = true) {
  const logFile = path.join(sessionDir, ".system_generated", "logs", "transcript.jsonl");
  if (!fs.existsSync(logFile)) return null;

  const st = fs.statSync(logFile);
  if (st.size > MAX_FILE) return null;

  const raw = fs.readFileSync(logFile, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const steps = [];
  for (const l of lines) {
    try { steps.push(JSON.parse(l)); } catch {}
  }
  if (!steps.length) return null;

  let firstDate = null, lastDate = null;
  let originPath = "";
  let rawProject = null;

  const turns = [];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.created_at) {
      if (!firstDate) firstDate = s.created_at;
      lastDate = s.created_at;
    }

    if (s.type === "USER_INPUT") {
      const text = s.content || "";
      if (!rawProject) rawProject = detectProjectFromText(text);

      const docMatch = text.match(/Active Document:\s*([^\r\n(]+)/);
      if (docMatch && !originPath) originPath = docMatch[1].trim();

      const userText = cleanUserText(text);
      if (userText) {
        turns.push({ who: "user", parts: [{ kind: "text", text: userText }] });
      }
    } else if (s.type === "PLANNER_RESPONSE") {
      const parts = [];

      if (withTools && s.thinking && s.thinking.trim()) {
        parts.push({ kind: "thinking", text: s.thinking.trim() });
      }

      if (s.tool_calls && s.tool_calls.length) {
        let toolResultIdx = i + 1;
        for (const tc of s.tool_calls) {
          if (!originPath && tc.args && tc.args.Cwd) originPath = tc.args.Cwd;
          if (!rawProject && tc.args) rawProject = detectProjectFromText(JSON.stringify(tc.args));

          let resultText = "";
          let isError = false;

          // Procura o próximo passo correspondente ao resultado desta ferramenta
          while (toolResultIdx < steps.length) {
            const next = steps[toolResultIdx++];
            if (next.type === "PLANNER_RESPONSE" || next.type === "USER_INPUT") {
              toolResultIdx--; // volta um passo pois é o próximo turno
              break;
            }
            // Passos de resultado de ferramenta (VIEW_FILE, RUN_COMMAND, CODE_ACTION etc.)
            if (next.content !== undefined || next.status === "ERROR") {
              resultText = String(next.content || "");
              isError = next.status === "ERROR";
              break;
            }
          }

          if (withTools) {
            parts.push({
              kind: "tool",
              name: tc.name,
              hint: toolHint(tc.name, tc.args),
              input: typeof tc.args === "object" ? JSON.stringify(tc.args, null, 2) : String(tc.args || ""),
              result: resultText,
              error: isError
            });
          }
        }
      }

      if (s.content && s.content.trim()) {
        parts.push({ kind: "text", text: s.content.trim() });
      }

      if (parts.length) {
        const last = turns[turns.length - 1];
        if (last && last.who === "gemini") {
          last.parts.push(...parts);
        } else {
          turns.push({ who: "gemini", parts });
        }
      }
    }
  }

  if (!turns.length) return null;

  // Determina título limpo da conversa
  let title = "";
  const firstUser = turns.find((t) => t.who === "user");
  if (firstUser && firstUser.parts[0] && firstUser.parts[0].text) {
    const firstLine = firstUser.parts[0].text.split("\n")[0];
    title = cleanTitle(firstLine);
  }
  if (!title) title = "Conversa sem título";

  return {
    sessionId,
    title,
    origin: originPath,
    project: rawProject || "desconhecido",
    first: firstDate || "",
    last: lastDate || "",
    turns
  };
}

function renderChat(c) {
  return renderChatMd({ title: c.title, sessionId: c.sessionId, origin: c.origin, first: c.first, last: c.last, agent: "gemini", assistantLabel: "Gemini" }, c.turns);
}

function listSessions(brainRoot) {
  if (!fs.existsSync(brainRoot)) throw new CliError(`Diretório do Antigravity/Gemini não encontrado em: ${brainRoot}`);

  return fs.readdirSync(brainRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const logFile = path.join(brainRoot, d.name, ".system_generated", "logs", "transcript.jsonl");
      if (!fs.existsSync(logFile)) return null;
      const st = fs.statSync(logFile);
      return { id: d.name, path: path.join(brainRoot, d.name), mtime: st.mtime, size: st.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

module.exports = { parseSession, renderChat, listSessions };

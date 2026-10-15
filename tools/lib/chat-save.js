// Salva no projeto a conversa feita na interface (botão "Conversar com o Projeto"), no mesmo formato dos importadores.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const state = require("./state");
const { redact } = require("./redact");
const { slugify } = require("./text");
const { readMeta, renderChat, escapeBlocks } = require("./chat-format");

// Salva a conversa gerada dentro de projects/<slug>/chats/ no formato padrão do Harness
function saveChatToProject({ slug, engine, title, turns, sessionId }) {
  const p = state.paths(slug);
  if (!fs.existsSync(p.chats)) fs.mkdirSync(p.chats, { recursive: true });

  // Título numa linha só: uma quebra de linha forjaria campos no cabeçalho (ex.: outro `sessao:`).
  title = String(title || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200) || "Conversa via Interface";

  // Igual aos importadores: o nome leva o início do id da sessão. Salvar de novo a mesma conversa
  // regrava o mesmo arquivo; duas conversas com o mesmo título no mesmo dia não se sobrescrevem.
  const sid = typeof sessionId === "string" && /^[\w-]{1,80}$/.test(sessionId) ? sessionId : crypto.randomUUID();
  const shortId = sid.replace(/^ses_/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toLowerCase();
  // Arquivos antigos da interface gravavam `sessao: "id"` (com aspas); a busca aceita os dois jeitos.
  const previous = fs.readdirSync(p.chats).find((f) => f.endsWith(`-${shortId}.md`) && readMeta(fs.readFileSync(path.join(p.chats, f), "utf8"))("sessao") === sid);
  const now = new Date().toISOString();
  const first = previous ? readMeta(fs.readFileSync(path.join(p.chats, previous), "utf8"))("inicio") || now : now; // `inicio` não muda a cada salvamento
  const fileName = previous || `${now.slice(0, 10)}-${slugify(title).slice(0, 50)}-${shortId}.md`;
  const fullPath = path.join(p.chats, fileName);

  const nameOf = (e) => (e === "gemini" ? "Gemini" : e === "opencode" ? "opencode" : "Claude");
  const agentTag = engine === "gemini" ? "gemini" : engine === "opencode" ? "opencode" : "claude";

  const chatTurns = turns.map((t) => {
    const parts = [];
    if (t.thinking) parts.push({ kind: "thinking", text: String(t.thinking), full: true });
    parts.push({ kind: "text", text: escapeBlocks(t.text) });
    // Cada resposta leva o motor que a gerou (o usuário pode trocar de motor no meio da conversa).
    return { who: t.role === "user" ? "user" : "assistant", label: nameOf(t.engine || engine), parts };
  });

  const text = renderChat({ title, sessionId: sid, origin: "harness-ui", first, last: now, agent: agentTag, assistantLabel: nameOf(engine) }, chatTurns);
  // Mesma redação de segredos e dados pessoais dos importadores (o que for digitado na UI também vai para chats/).
  fs.writeFileSync(fullPath, redact(text), "utf8");

  // Atualiza automaticamente o mapa e a tabela Markdown
  try {
    state.generateTableMarkdown(slug);
  } catch {}

  return { fileName, path: fullPath };
}

module.exports = { saveChatToProject };

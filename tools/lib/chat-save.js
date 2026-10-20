// @ts-check
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

  const LABELS = { gemini: "Gemini", opencode: "opencode", codex: "Codex", ollama: "Ollama" };
  const nameOf = (e) => LABELS[e] || "Claude";
  const agentTag = (e) => LABELS[e] ? e : "claude";

  const chatTurns = turns.map((t) => {
    /** @type {import("./types").Part[]} */
    const parts = [];
    if (t.thinking) parts.push({ kind: "thinking", text: String(t.thinking), full: true });
    parts.push({ kind: "text", text: escapeBlocks(t.text) });
    // Metadados da interceptação HIA viajam como bloco de ferramenta: o texto do turno fica limpo
    // e leitores antigos do formato apenas veem mais uma etapa interna.
    if (t.hiaRoute) {
      parts.push({
        kind: "tool",
        name: `hia-${String(t.hiaRoute).replace(/[^a-z_]/gi, "")}`,
        hint: String(t.hiaTool || t.hiaModel || t.hiaRoute).replace(/\|/g, "/"),
        input: "",
        result: String(Number(t.tokensSaved) || 0),
      });
    }
    // Cada resposta leva o motor que a gerou (o usuário pode trocar de motor no meio da conversa).
    return { who: t.role === "user" ? "user" : "assistant", label: nameOf(t.engine || engine), parts };
  });

  const text = renderChat({ title, sessionId: sid, origin: "harness-ui", first, last: now, agent: agentTag(engine), assistantLabel: nameOf(engine) }, chatTurns);
  // Mesma redação de segredos e dados pessoais dos importadores (o que for digitado na UI também vai para chats/).
  fs.writeFileSync(fullPath, redact(text), "utf8");

  // Atualiza automaticamente o mapa e a tabela Markdown
  try {
    state.writeTable(slug);
  } catch {}

  return { fileName, path: fullPath };
}

module.exports = { saveChatToProject };

// Formato do .md de conversa em projects/<slug>/chats/: único lugar que escreve e lê esse formato no servidor e nas CLIs.
// (ui/public/index.html tem um leitor próprio, pois roda no navegador: se mudar algo aqui, ajuste lá também.)
//
//   ---
//   titulo: "..."            (JSON)
//   sessao: <id>             (sem aspas; a leitura aceita com e sem)
//   origem: "..."            (JSON)
//   inicio: <ISO>
//   fim: <ISO>
//   agente: "claude|gemini|opencode"
//   ---
//
//   # <título>
//
//   ## Você | Claude | Gemini | opencode      <- um por turno
//   texto...
//   :::thinking ... :::                       <- raciocínio
//   :::tool <nome> | <resumo> [| erro]  --- entrada ... --- resultado ... :::   <- ferramenta
//   > linha                                   <- nota (kind "note"), citada
const { safe } = require("./text");

// ---------- falantes ----------

const SPEAKERS = ["Você", "Claude", "Gemini", "Antigravity", "opencode"];

// Novo RegExp a cada chamada: regex global tem estado (lastIndex) e não pode ser compartilhada.
const turnHeading = (flags = "im") => new RegExp(`^## (${SPEAKERS.join("|")})\\s*$`, flags);

const countTurns = (raw) => (raw.match(turnHeading("gim")) || []).length;

// Divide o corpo em [{ speaker, text }] pelos títulos "## <falante>"; turnos vazios ficam de fora.
function splitTurns(body) {
  const pieces = body.split(turnHeading("im")).slice(1); // [falante, texto, falante, texto, ...]
  const turns = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const text = (pieces[i + 1] || "").trim();
    if (text) turns.push({ speaker: pieces[i], text });
  }
  return turns;
}

// ---------- leitura ----------

// Cabeçalho entre os "---" do início (aceita CRLF e BOM); "" se não houver.
const frontmatterOf = (raw) => (raw.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || "";

// Valor de um campo do cabeçalho, sem aspas nas pontas ("" se não existir).
function readMeta(raw) {
  const fm = frontmatterOf(raw);
  return (key) => { const m = fm.match(new RegExp(`^${key}: (.*)$`, "m")); return m ? m[1].replace(/^"|"$/g, "") : ""; };
}

const stripFrontmatter = (raw) => raw.replace(/^﻿/, "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

// Remove blocos :::tool e :::thinking (o que não é fala).
const stripBlocks = (body) => body.replace(/^:::(tool|thinking)[^\n]*\n[\s\S]*?^:::$/gm, "");

// O que entra na impressão digital da conversa (state.readChat): só o conteúdo. Cabeçalho e título (que um agente pode
// renomear) ficam de fora, e `## opencode` conta como `## Claude` (o importador do opencode já usou esse título).
// ATENÇÃO: os bytes do conteúdo não podem ser normalizados (ex.: CRLF dentro de saídas de comando), senão o hash
// gravado em extraction-state.json deixa de bater e toda conversa antiga vira "alterada".
const hashBody = (raw) => stripFrontmatter(raw).replace(/^# .*\r?\n/, "").replace(/^## opencode[ \t]*$/gim, "## Claude");

// ---------- escrita ----------

// Linhas ":::" no conteúdo fechariam um bloco antes da hora; um espaço de largura zero as desarma (sem cortar o texto).
const escapeBlocks = (s) => String(s ?? "").replace(/^:::/gm, "::​:");

// Partes: { kind: "text"|"note"|"thinking"|"tool", ... }. `full: true` num "thinking" dispensa o corte de tamanho
// (chats salvos pela interface guardam o raciocínio inteiro; os importadores cortam em MAX_IO como nas ferramentas).
function renderPart(p) {
  if (p.kind === "text") return p.text;
  if (p.kind === "note") return p.text.split("\n").map((l) => `> ${l}`).join("\n");
  if (p.kind === "thinking") return `:::thinking\n${p.full ? escapeBlocks(p.text) : safe(p.text)}\n:::`;
  return `:::tool ${p.name} | ${String(p.hint).replace(/\|/g, "/")}${p.error ? " | erro" : ""}\n--- entrada\n${safe(p.input)}\n--- resultado\n${safe(p.result)}\n:::`;
}

// meta: { title, sessionId, origin, first, last, agent, assistantLabel }
// turns: [{ who: "user" | outro, label?, parts: [...] }] — turnos que não são do usuário usam `label` ou meta.assistantLabel.
function renderChat(meta, turns) {
  const head = [
    "---",
    `titulo: ${JSON.stringify(meta.title)}`,
    `sessao: ${meta.sessionId}`,
    `origem: ${JSON.stringify(meta.origin)}`,
    `inicio: ${meta.first || ""}`,
    `fim: ${meta.last || ""}`,
    `agente: ${JSON.stringify(meta.agent)}`,
    "---",
    "",
    `# ${meta.title}`,
    "",
  ];
  const body = turns.map((t) =>
    `## ${t.who === "user" ? "Você" : t.label || meta.assistantLabel}\n\n${t.parts.map(renderPart).join("\n\n")}\n`);
  return head.concat(body).join("\n");
}

module.exports = { SPEAKERS, turnHeading, countTurns, splitTurns, frontmatterOf, readMeta, stripFrontmatter, stripBlocks, hashBody, escapeBlocks, renderPart, renderChat };

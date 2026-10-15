// Controle de quais conversas já foram analisadas e se mudaram depois disso.
// Estado em projects/<slug>/extraction-state.json, indexado pelo id da sessão (campo `sessao` do .md).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { ROOT } = require("./root");
const { readMeta, hashBody, countTurns } = require("./chat-format");
const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/;

function paths(slug) {
  if (!SLUG.test(slug || "") || slug === "_template") throw new Error("projeto inválido");
  const proj = path.join(ROOT, "projects", slug);
  return {
    proj,
    chats: path.join(proj, "chats"),
    state: path.join(proj, "extraction-state.json"),
    memorias: path.join(proj, "context", "extraido-memorias.md"),
    tabela: path.join(proj, "context", "extraido-conversas.md"),
  };
}

// Lê um chat importado: identidade (sessão), tamanho (turnos) e impressão digital do conteúdo (hash).
function readChat(file) {
  const raw = fs.readFileSync(file, "utf8");
  const get = readMeta(raw);
  // O hash cobre só o conteúdo da conversa (regras e cuidados em chat-format.hashBody).
  const body = hashBody(raw);
  return {
    name: path.basename(file),
    sessao: get("sessao") || path.basename(file),
    titulo: get("titulo") || path.basename(file),
    data: get("inicio").slice(0, 10),
    fim: get("fim"),
    turnos: countTurns(raw),
    hash: crypto.createHash("sha1").update(body).digest("hex").slice(0, 16),
  };
}

// Arquivo ausente, ilegível ou sem o campo `sessoes` (editado à mão, versão antiga): começa vazio em vez de quebrar o scan.
function load(slug) {
  let st = null;
  try { st = JSON.parse(fs.readFileSync(paths(slug).state, "utf8")); } catch { /* sem estado ainda */ }
  if (!st || typeof st !== "object") st = { version: 1 };
  if (!st.sessoes || typeof st.sessoes !== "object" || Array.isArray(st.sessoes)) st.sessoes = {};
  return st;
}
function save(slug, st) { fs.writeFileSync(paths(slug).state, JSON.stringify(st, null, 2) + "\n"); }

// status: "nova" (nunca analisada) | "alterada" (mudou depois da análise) | "ok" (em dia)
function scan(slug) {
  const p = paths(slug), st = load(slug);
  if (!fs.existsSync(p.chats)) return [];
  let migrated = false;
  const list = fs.readdirSync(p.chats).filter((f) => f.endsWith(".md")).map((f) => {
    const c = readChat(path.join(p.chats, f)), prev = st.sessoes[c.sessao];
    let status = !prev ? "nova" : prev.hash === c.hash ? "ok" : "alterada";
    // Entradas antigas (hash do arquivo inteiro, sem `v`): se o nº de turnos não mudou, adota o novo hash uma vez.
    if (status === "alterada" && prev.v !== 2 && prev.turnos === c.turnos) { prev.hash = c.hash; prev.v = 2; status = "ok"; migrated = true; }
    return { ...c, status, antes: prev || null };
  });
  if (migrated) save(slug, st);
  return list.sort((a, b) => (b.fim || "").localeCompare(a.fim || ""));
}

// Gera e atualiza a tabela Markdown em projects/<slug>/context/extraido-conversas.md
function generateTableMarkdown(slug) {
  const p = paths(slug);
  const rows = scan(slug);
  if (!rows.length) return "";
  const n = (s) => rows.filter((r) => r.status === s).length;
  const lines = [
    `# Mapeamento de Conversas e Estado de Extração — ${slug}`,
    "",
    `> Gerado automaticamente por \`tools/extraction-state.js\` em ${new Date().toISOString().slice(0, 10)}.`,
    `> **Sugestões para revisão**: nada aqui foi copiado para \`memory.md\` ou \`instructions.md\`.`,
    "",
    `### Resumo`,
    `- **Total de conversas:** ${rows.length}`,
    `- **Em dia (analisadas):** ${n("ok")}`,
    `- **Pendentes (novas):** ${n("nova")}`,
    `- **Alteradas (com novos turnos após análise):** ${n("alterada")}`,
    "",
    "### Como analisar as conversas pendentes",
    "Use a skill `extrair-artefatos` ou execute:",
    "```bash",
    `node tools/extraction-state.js --project ${slug} status`,
    `node tools/extraction-state.js --project ${slug} pending --limit 5`,
    "```",
    "",
    "### Tabela de Mapeamento",
    "",
    "| # | Conversa / Título | Arquivo | Data | Turnos | Status | Analisado por | Analisado em |",
    "|---|---|---|:---:|:---:|:---:|:---:|:---:|",
  ];

  rows.forEach((r, idx) => {
    const isAlt = r.status === "alterada";
    const stIcon = r.status === "ok" ? "✅ Em dia" : isAlt ? "↻ Alterada" : "⏳ Pendente";
    const turnosStr = isAlt && r.antes ? `${r.antes.turnos} → ${r.turnos}` : `${r.turnos}`;
    const por = r.antes ? r.antes.por || "desconhecido" : "-";
    const dataAnalisado = r.antes && r.antes.analisadoEm ? r.antes.analisadoEm.slice(0, 10) : "-";
    const fileRel = `../chats/${r.name}`;
    const cleanTitle = r.titulo.replace(/\|/g, "\\-").replace(/[\r\n]+/g, " ");
    lines.push(`| ${idx + 1} | [${cleanTitle}](${fileRel}) | \`${r.name}\` | ${r.data || "-"} | ${turnosStr} | ${stIcon} | ${por} | ${dataAnalisado} |`);
  });

  lines.push("");
  const md = lines.join("\n");
  const ctxDir = path.join(p.proj, "context");
  if (fs.existsSync(ctxDir)) {
    fs.writeFileSync(p.tabela, md, "utf8");
  }
  return md;
}

// Registra como analisadas as conversas indicadas (nomes de arquivo dentro de chats/).
function mark(slug, names, by) {
  const p = paths(slug), st = load(slug), done = [];
  for (const n of names) {
    const file = path.join(p.chats, path.basename(n)); // basename: sem path traversal
    if (!fs.existsSync(file)) throw new Error(`chat não encontrado: ${path.basename(n)}`);
    const c = readChat(file);
    st.sessoes[c.sessao] = { v: 2, arquivo: c.name, titulo: c.titulo, hash: c.hash, turnos: c.turnos, fim: c.fim, analisadoEm: new Date().toISOString(), por: by || "desconhecido" };
    done.push(c.name);
  }
  save(slug, st);
  generateTableMarkdown(slug);
  return done;
}

module.exports = { paths, readChat, load, save, scan, mark, generateTableMarkdown };

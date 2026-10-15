// @ts-check
// Controle de quais conversas já foram analisadas e se mudaram depois disso.
// Estado em projects/<slug>/extraction-state.json, indexado pelo id da sessão (campo `sessao` do .md).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { ROOT } = require("./root");
const { readMeta, hashBody, countTurns } = require("./chat-format");
const { statusOf, renderTable } = require("./extraction");
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
/** @param {string} file @returns {import("./types").ChatInfo} */
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

// Conversas do projeto com o status de cada uma (ver extraction.statusOf), da mais recente para a mais antiga.
// É só leitura: não grava nada. Entradas antigas contam como em dia quando o nº de turnos não mudou; para gravar o
// hash novo no estado, use migrateLegacy (os comandos de linha de comando chamam; a interface web não).
/** @param {string} slug @returns {import("./types").ChatRow[]} */
function scan(slug) {
  const p = paths(slug), st = load(slug);
  if (!fs.existsSync(p.chats)) return [];
  const list = fs.readdirSync(p.chats).filter((f) => f.endsWith(".md")).map((f) => {
    const c = readChat(path.join(p.chats, f)), prev = st.sessoes[c.sessao];
    const { status, adopt } = statusOf(prev, c);
    return { ...c, status, adopt, antes: prev || null };
  });
  return list.sort((a, b) => (b.fim || "").localeCompare(a.fim || ""));
}

// Grava no estado o hash novo das entradas antigas (sem `v`) cujo nº de turnos não mudou. Devolve quantas migrou.
function migrateLegacy(slug) {
  const st = load(slug);
  const legacy = scan(slug).filter((r) => r.adopt);
  for (const r of legacy) Object.assign(st.sessoes[r.sessao], { hash: r.hash, v: 2 });
  if (legacy.length) save(slug, st);
  return legacy.length;
}

// Grava a tabela de conversas em projects/<slug>/context/extraido-conversas.md (se a pasta context/ existir).
// Devolve o Markdown ("" se não há conversas).
function writeTable(slug) {
  const p = paths(slug);
  const md = renderTable(slug, scan(slug), new Date().toISOString().slice(0, 10));
  if (md && fs.existsSync(path.join(p.proj, "context"))) fs.writeFileSync(p.tabela, md, "utf8");
  return md;
}

// Registra como analisadas as conversas indicadas (nomes de arquivo dentro de chats/). Só atualiza o estado:
// quem quiser a tabela atualizada chama writeTable depois.
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
  return done;
}

module.exports = { paths, readChat, load, save, scan, migrateLegacy, mark, writeTable };

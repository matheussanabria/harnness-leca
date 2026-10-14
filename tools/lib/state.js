// Controle de quais conversas já foram analisadas e se mudaram depois disso.
// Estado em projects/<slug>/extraction-state.json, indexado pelo id da sessão (campo `sessao` do .md).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..", "..");
const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/;

function paths(slug) {
  if (!SLUG.test(slug || "") || slug === "_template") throw new Error("projeto inválido");
  const proj = path.join(ROOT, "projects", slug);
  return { proj, chats: path.join(proj, "chats"), state: path.join(proj, "extraction-state.json"), memorias: path.join(proj, "context", "extraido-memorias.md") };
}

// Lê um chat importado: identidade (sessão), tamanho (turnos) e impressão digital do conteúdo (hash).
function readChat(file) {
  const raw = fs.readFileSync(file, "utf8");
  const fm = (raw.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const get = (k) => { const m = fm.match(new RegExp(`^${k}: (.*)$`, "m")); return m ? m[1].replace(/^"|"$/g, "") : ""; };
  return {
    name: path.basename(file),
    sessao: get("sessao") || path.basename(file),
    titulo: get("titulo") || path.basename(file),
    data: get("inicio").slice(0, 10),
    fim: get("fim"),
    turnos: (raw.match(/^## (Você|Claude)\s*$/gm) || []).length,
    hash: crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16),
  };
}

function load(slug) {
  try { return JSON.parse(fs.readFileSync(paths(slug).state, "utf8")); } catch { return { version: 1, sessoes: {} }; }
}
function save(slug, st) { fs.writeFileSync(paths(slug).state, JSON.stringify(st, null, 2) + "\n"); }

// status: "nova" (nunca analisada) | "alterada" (mudou depois da análise) | "ok" (em dia)
function scan(slug) {
  const p = paths(slug), st = load(slug);
  if (!fs.existsSync(p.chats)) return [];
  const list = fs.readdirSync(p.chats).filter((f) => f.endsWith(".md")).map((f) => {
    const c = readChat(path.join(p.chats, f)), prev = st.sessoes[c.sessao];
    const status = !prev ? "nova" : prev.hash === c.hash ? "ok" : "alterada";
    return { ...c, status, antes: prev || null };
  });
  return list.sort((a, b) => (b.fim || "").localeCompare(a.fim || ""));
}

// Registra como analisadas as conversas indicadas (nomes de arquivo dentro de chats/).
function mark(slug, names, by) {
  const p = paths(slug), st = load(slug), done = [];
  for (const n of names) {
    const file = path.join(p.chats, path.basename(n)); // basename: sem path traversal
    if (!fs.existsSync(file)) throw new Error(`chat não encontrado: ${path.basename(n)}`);
    const c = readChat(file);
    st.sessoes[c.sessao] = { arquivo: c.name, titulo: c.titulo, hash: c.hash, turnos: c.turnos, fim: c.fim, analisadoEm: new Date().toISOString(), por: by || "desconhecido" };
    done.push(c.name);
  }
  save(slug, st);
  return done;
}

module.exports = { paths, readChat, load, save, scan, mark };

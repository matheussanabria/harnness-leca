// Como o chat da interface roda o Claude em cada projeto: em qual repositório, com que permissões e com quais MCPs.
// Sem projects/<slug>/mcp.json: roda na pasta do projeto, sem MCP.
//
// projects/<slug>/mcp.json (fica só na sua máquina, como o resto de projects/):
//   {
//     "repo": "C:/Users/voce/git/57multimarcas",   // opcional: pasta de trabalho do Claude (lê, edita e roda comandos nela)
//     "servidores": ["cod-design-system"],          // quais servidores do .mcp.json do repo carregar
//     "mcpServers": { "outro": { "command": "node", "args": ["C:/abs/server.js"] } },  // opcional: servidores próprios
//     "modo": "leitura"                             // opcional: só leitura (sem editar nem rodar comandos)
//   }
//
// Os caminhos relativos do .mcp.json do repositório (ex.: "tools/x-mcp/src/server.js") valem a partir da raiz
// dele; são convertidos para absolutos aqui.
const fs = require("fs");
const path = require("path");

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/; // o nome vira regra de permissão (mcp__<nome>): nada de curingas ou espaços
const MODES = new Set(["completo", "leitura"]);

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));

// Converte para absoluto só o que parece caminho relativo e existe dentro do repositório.
function absolutize(server, repo) {
  const fix = (a) => {
    if (typeof a !== "string" || path.isAbsolute(a) || a.startsWith("-")) return a;
    const abs = path.resolve(repo, a);
    return abs.startsWith(path.resolve(repo) + path.sep) && fs.existsSync(abs) ? abs : a;
  };
  const out = { ...server };
  if (out.command) out.command = fix(out.command);
  if (Array.isArray(out.args)) out.args = out.args.map(fix);
  return out;
}

// Retorna { repo, modo, mcpServers, names }. Erros de configuração são lançados com mensagem clara
// (melhor que rodar o Claude no lugar errado ou com um MCP pela metade).
function loadProjectConfig(projDir) {
  const file = path.join(projDir, "mcp.json");
  const none = { repo: null, modo: "completo", mcpServers: {}, names: [] };
  if (!fs.existsSync(file)) return none;
  const cfg = readJson(file);

  const modo = cfg.modo || "completo";
  if (!MODES.has(modo)) throw new Error(`mcp.json: "modo" deve ser ${[...MODES].join(" ou ")}`);

  let repo = null;
  const servers = {};
  if (cfg.repo) {
    repo = path.resolve(String(cfg.repo));
    if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) throw new Error(`mcp.json: repo ${repo} não existe`);
    const wanted = Array.isArray(cfg.servidores) ? cfg.servidores : [];
    if (wanted.length) {
      const repoFile = path.join(repo, ".mcp.json");
      const available = fs.existsSync(repoFile) ? readJson(repoFile).mcpServers || {} : {};
      for (const name of wanted) {
        if (!available[name]) throw new Error(`mcp.json: servidor "${name}" não está em ${repoFile}`);
        servers[name] = absolutize(available[name], repo);
      }
    }
  }
  Object.assign(servers, cfg.mcpServers || {});

  const names = Object.keys(servers);
  const bad = names.find((n) => !NAME_RE.test(n));
  if (bad) throw new Error(`mcp.json: nome de servidor inválido "${bad}" (use letras, números, - ou _)`);
  return { repo, modo, mcpServers: servers, names };
}

module.exports = { loadProjectConfig };

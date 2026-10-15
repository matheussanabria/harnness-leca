// @ts-check
// Caminho absoluto do executável do Claude Code, para rodar com shell:false.
// Com shell:true (ou com o nome solto), o Windows procura "claude" primeiro na pasta atual: um claude.cmd
// deixado em projects/<slug>/ rodaria no lugar do verdadeiro. Aqui só valem CLAUDE_BIN e as pastas do PATH.
//
// Ordem: CLAUDE_BIN (global/.env ou ambiente) > claude.exe no PATH > claude.exe do pacote npm apontado por
// claude.cmd (o .cmd do npm só repassa para node_modules/@anthropic-ai/claude-code/bin/claude.exe).
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./env");

const WIN = process.platform === "win32";
const NPM_EXE = path.join("node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
let cached;

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// Pastas do PATH, só absolutas: uma entrada relativa (ou vazia) equivaleria a procurar na pasta atual.
const pathDirs = () => String(process.env.PATH || "").split(path.delimiter).map((d) => d.replace(/^"|"$/g, "")).filter((d) => d && path.isAbsolute(d));

function resolveClaudeBin() {
  if (cached !== undefined) return cached;
  loadEnv(); // CLAUDE_BIN pode estar em global/.env
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv && path.isAbsolute(fromEnv) && isFile(fromEnv)) return (cached = fromEnv);

  const dirs = pathDirs();
  const names = WIN ? ["claude.exe"] : ["claude"];
  for (const d of dirs) for (const n of names) if (isFile(path.join(d, n))) return (cached = path.join(d, n));
  if (WIN) for (const d of dirs) if (isFile(path.join(d, "claude.cmd")) && isFile(path.join(d, NPM_EXE))) return (cached = path.join(d, NPM_EXE));
  return (cached = null);
}

// Para testes e para quando o usuário instala o Claude com o servidor já aberto.
const resetClaudeBin = () => { cached = undefined; };

module.exports = { resolveClaudeBin, resetClaudeBin };

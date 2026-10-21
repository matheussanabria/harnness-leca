// @ts-check
// Runner do TypeScript: instala (com cache) e executa o tsc sobre o jsconfig do repositorio.
// Compartilhado por `npm run types` e pelo baseline de tipos, para que os dois usem
// exatamente a mesma versao e o mesmo conjunto de arquivos.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const TYPESCRIPT = "5.6.3";
const NODE_TYPES = "22";

/**
 * @returns {string} caminho do executavel do tsc
 */
function ensureTsc() {
  const dir = path.join(os.tmpdir(), `harness-types-ts${TYPESCRIPT}-node${NODE_TYPES}`);
  const tsc = path.join(dir, "node_modules", "typescript", "bin", "tsc");
  if (fs.existsSync(tsc)) return tsc;
  console.log(`Instalando typescript@${TYPESCRIPT} e @types/node@${NODE_TYPES} em ${dir} (na primeira vez)...`);
  fs.mkdirSync(dir, { recursive: true });
  const win = process.platform === "win32";
  const r = spawnSync(win ? "npm.cmd" : "npm", ["install", "--prefix", dir, "--no-audit", "--no-fund", "--loglevel=error", `typescript@${TYPESCRIPT}`, `@types/node@${NODE_TYPES}`], { stdio: "inherit", shell: win });
  if (r.status !== 0 || !fs.existsSync(tsc)) {
    console.error("Nao foi possivel instalar o TypeScript (sem rede?)");
    process.exit(1);
  }
  return tsc;
}

/**
 * Roda o tsc e devolve o resultado sem levantar.
 * @param {{ cwd?: string }} [options]
 * @returns {{ status: number, output: string, errors: number, files: Set<string> }}
 */
function runTsc(options = {}) {
  const tsc = ensureTsc();
  const cwd = options.cwd || ROOT;
  const r = spawnSync(
    process.execPath,
    [tsc, "-p", path.join(ROOT, "jsconfig.json"), "--noEmit", "--pretty", "false", "--typeRoots", path.join(path.dirname(path.dirname(tsc)), "..", "@types"), "--types", "node"],
    { cwd, encoding: "utf8" },
  );
  const output = `${r.stdout || ""}${r.stderr || ""}`;
  const files = new Set();
  let errors = 0;
  for (const line of output.split(/\r?\n/)) {
    const m = /^(.+?)\((\d+),(\d+)\): error TS/.exec(line);
    if (!m) continue;
    errors += 1;
    files.add(m[1]);
  }
  return { status: r.status ?? 1, output, errors, files };
}

module.exports = { runTsc, ensureTsc, TYPESCRIPT, NODE_TYPES };

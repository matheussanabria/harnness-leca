#!/usr/bin/env node
// Checagem de tipos por JSDoc nos arquivos que têm `// @ts-check` na primeira linha (jsconfig.json), sem acrescentar
// dependência ao projeto: instala o TypeScript e os tipos do Node numa pasta temporária (com cache) e roda o tsc de lá.
//   npm run types
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TYPESCRIPT = "5.6.3";
const NODE_TYPES = "22";
const dir = path.join(os.tmpdir(), `harness-types-ts${TYPESCRIPT}-node${NODE_TYPES}`);
const tsc = path.join(dir, "node_modules", "typescript", "bin", "tsc");

if (!fs.existsSync(tsc)) {
  console.log(`Instalando typescript@${TYPESCRIPT} e @types/node@${NODE_TYPES} em ${dir} (só na primeira vez)...`);
  fs.mkdirSync(dir, { recursive: true });
  const win = process.platform === "win32";
  // Argumentos fixos, sem entrada do usuário; no Windows o npm é um .cmd e só roda com shell.
  const r = spawnSync(win ? "npm.cmd" : "npm", ["install", "--prefix", dir, "--no-audit", "--no-fund", "--loglevel=error", `typescript@${TYPESCRIPT}`, `@types/node@${NODE_TYPES}`], { stdio: "inherit", shell: win });
  if (r.status !== 0 || !fs.existsSync(tsc)) { console.error("✖ não consegui instalar o TypeScript (sem rede?)"); process.exit(1); }
}

const r = spawnSync(process.execPath, [tsc, "-p", path.join(ROOT, "jsconfig.json"), "--noEmit", "--typeRoots", path.join(dir, "node_modules", "@types"), "--types", "node"], { cwd: ROOT, stdio: "inherit" });
if (r.status === 0) console.log("✔ tipos sem erro");
process.exit(r.status ?? 1);

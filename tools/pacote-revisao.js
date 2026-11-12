#!/usr/bin/env node
// @ts-check
/**
 * pacote-revisao: gera o pacote autonomo de revisao (quadro de historias + mapa em camadas, em HTML unico)
 * para quem nao tem o Harness, e confere se ele e os ajustes manuais ainda sao verdadeiros.
 *
 *   node tools/pacote-revisao.js build --project <slug> [--out <pasta>] [--zip] [--config <arquivo>]
 *   node tools/pacote-revisao.js check --project <slug> [--out <pasta>] [--com-deriva] [--json]
 *
 * build: so escreve quadro-historias.html, mapa-camadas.html e .pacote-revisao.json na pasta; nao apaga nem copia doc/.
 * check: sai com 1 se houver erro e com 2 se so houver avisos e --estrito. Nao escreve nada.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadConfig, projectsDir, repoDirOf, ROOT } = require("./pacote-revisao/config");
const { collectMap } = require("./pacote-revisao/map-data");
const { collectBoard } = require("./pacote-revisao/board-data");
const { renderBoardHtml } = require("./pacote-revisao/board-html");
const { renderMapHtml } = require("./pacote-revisao/map-bundle");
const { fingerprint, writeManifest, hashFile } = require("./pacote-revisao/manifest");
const { runCheck } = require("./pacote-revisao/check");

const BOARD = "quadro-historias.html";
const MAP = "mapa-camadas.html";

/** @param {string[]} argv */
function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {Record<string, string|boolean>} */
  const o = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) throw new Error(`argumento inesperado: ${a}`);
    const name = a.slice(2);
    if (["zip", "com-deriva", "json", "estrito"].includes(name)) o[name] = true;
    else if (rest[i + 1] === undefined) throw new Error(`--${name} exige um valor`);
    else o[name] = rest[++i];
  }
  return { command, opts: o };
}

/** @param {Record<string, string|boolean>} opts */
function context(opts) {
  const slug = String(opts.project || "");
  if (!slug) throw new Error("--project e obrigatorio");
  const projectDir = path.join(projectsDir(), slug);
  if (!fs.existsSync(projectDir)) throw new Error(`projeto nao encontrado: ${slug}`);
  const repo = repoDirOf(slug);
  if (!repo) throw new Error(`o projeto ${slug} nao declara "repo" em mcp.json`);
  const { file, config } = loadConfig(slug, opts.config ? String(opts.config) : undefined);
  const out = String(opts.out || config.pasta || "");
  if (!out) throw new Error("informe --out <pasta> ou \"pasta\" na configuracao");
  return { slug, projectDir, repo, configFile: file, config, outDir: path.resolve(out) };
}

/** Dados que o quadro e o mapa usam; o `check` reaproveita sem escrever nada. */
function collectAll(ctx) {
  const map = collectMap(ctx);
  const board = collectBoard({ slug: ctx.slug, repo: ctx.repo, outDir: ctx.outDir, config: ctx.config, screens: map.screensData.screens });
  const snapFile = path.join(ctx.repo, "doc", "scrum", "_jira-dis.json");
  const snapshotEm = fs.existsSync(snapFile) ? fs.statSync(snapFile).mtime.toISOString() : undefined;
  return { map, board, snapshotEm };
}

/** @param {string} dir */
function zipFolder(dir) {
  const zip = `${dir.replace(/[\\/]+$/, "")}.zip`;
  if (fs.existsSync(zip)) fs.rmSync(zip);
  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${path.join(dir, "*").replace(/'/g, "''")}' -DestinationPath '${zip.replace(/'/g, "''")}' -CompressionLevel Optimal`], { stdio: "ignore" });
  } else {
    execFileSync("zip", ["-qr", zip, "."], { cwd: dir, stdio: "ignore" });
  }
  return zip;
}

async function build(opts) {
  const ctx = context(opts);
  fs.mkdirSync(ctx.outDir, { recursive: true });
  const { map, board, snapshotEm } = collectAll(ctx);
  fs.writeFileSync(path.join(ctx.outDir, BOARD), renderBoardHtml({ board, config: ctx.config, snapshotEm }));
  fs.writeFileSync(path.join(ctx.outDir, MAP), await renderMapHtml(map, { slug: ctx.slug, boardFile: BOARD }));
  const fontes = fingerprint({ ...ctx, historias: ctx.config.historias });
  writeManifest(ctx.outDir, { geradoEm: new Date().toISOString(), projeto: ctx.slug, historias: ctx.config.historias, fontes });
  console.log(`quadro: ${path.join(ctx.outDir, BOARD)} (${board.stories.length} historias)`);
  console.log(`mapa:   ${path.join(ctx.outDir, MAP)} (${map.screensData.screens.length} telas, ${Object.keys(map.protos).length} prototipos)`);
  if (opts.zip) console.log(`zip:    ${zipFolder(ctx.outDir)}`);
  const found = runCheck({ ctx, map, board, comDrift: false }).filter((f) => f.level !== "info" && f.code !== "PACOTE_DEFASADO");
  if (found.length) console.log(`\nAtencao (${found.length}); rode "check" para os detalhes.`);
  return 0;
}

function check(opts) {
  const ctx = context(opts);
  const { map, board } = collectAll(ctx);
  const findings = runCheck({ ctx, map, board, comDrift: Boolean(opts["com-deriva"]) });
  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2));
  } else if (!findings.length) {
    console.log("pacote-revisao: nada defasado.");
  } else {
    for (const f of findings) console.log(`${f.level.toUpperCase().padEnd(5)} ${f.code}: ${f.message}`);
    console.log(`\n${findings.filter((f) => f.level === "erro").length} erro(s), ${findings.filter((f) => f.level === "aviso").length} aviso(s).`);
  }
  if (findings.some((f) => f.level === "erro")) return 1;
  return opts.estrito && findings.some((f) => f.level === "aviso") ? 2 : 0;
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (command === "build") return build(opts);
  if (command === "check") return check(opts);
  console.error("uso: node tools/pacote-revisao.js build|check --project <slug> [--out <pasta>] [--zip] [--com-deriva] [--json] [--estrito] [--config <arquivo>]");
  return 64;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(`pacote-revisao: ${e.message}`); process.exitCode = 1; });
}

module.exports = { parseArgs, context, collectAll, BOARD, MAP, hashFile };

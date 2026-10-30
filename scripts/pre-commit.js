#!/usr/bin/env node
// Hook de pre-commit (ativar com: npm run setup:hooks). Barra o commit quando:
//   1. entra um arquivo que é dado local (projects/, global/*.md e .env, bridge/): o .gitignore já os exclui, isto pega o `git add -f`;
//   2. uma linha ADICIONADA tem um segredo de formato conhecido (chave de API, JWT, webhook, chave privada...).
//      Exemplos e fixtures: ponha "allow-secret" num comentário da mesma linha;
//   3. entra arquivo novo e o MAPA.md nao foi atualizado no mesmo commit (e o arquivo, sua pasta ou seu nome nao aparecem no mapa);
//   4. o check de sintaxe/JSON dos arquivos staged falha;
//   5. os testes afetados pelos arquivos staged falham (EP-14.02). Commit só de documentação pula os testes,
//      assim como HARNESS_SKIP_TESTS=1. A suíte completa roda no pre-push e no CI.
// Nunca imprime o segredo achado: só arquivo, linha e tipo.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { findSecrets } = require("../tools/lib/redact");
const { affectedTests } = require("./lib/affected-tests");
const { readMapaText } = require("./lib/read-mapa");

// Dados locais que nunca devem ir para o repositório (o que o .gitignore já exclui; aqui vale mesmo com `git add -f`).
function forbiddenPath(rel) {
  const p = rel.replace(/\\/g, "/");
  if (/^projects\/_template(\/|$)/.test(p)) return null;
  if (/^projects\//.test(p)) return "dados de projeto (projects/ é local; só o _template sobe)";
  if (/^global\/(instructions|memory)\.md$/.test(p)) return "instruções/memória globais pessoais (use os *.example.md)";
  if (/(^|\/)\.env($|\.)/.test(p) && !/\.example$/.test(p)) return "arquivo .env (pode ter chaves)";
  if (/^bridge\/.+\.jsonl$/.test(p)) return "fila local do bridge (tem prompts)";
  return null;
}

// O mapa é o MAPA.md (porta de entrada) mais os arquivos por área em docs/mapa/.
const isMapFile = (p) => p === "MAPA.md" || /^docs\/mapa\/.+\.md$/.test(p.replace(/\\/g, "/"));

// Arquivos novos que o mapa ainda não conhece. Vale como mapeado: o mapa (MAPA.md ou docs/mapa/) ter sido alterado no mesmo
// commit, ou ele citar o caminho, o nome do arquivo ou uma das pastas do caminho. Ignora o próprio mapa, .gitkeep e os golden masters.
function missingFromMapa(added, mapaText, mapaTouched) {
  if (mapaTouched) return [];
  const mapa = mapaText.replace(/\\/g, "/");
  return added.map((f) => f.replace(/\\/g, "/")).filter((p) => {
    if (isMapFile(p) || p.endsWith(".gitkeep") || p.startsWith("tests/golden/")) return false;
    const parts = p.split("/");
    const dirs = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/") + "/");
    return ![p, parts[parts.length - 1], ...dirs].some((c) => mapa.includes(c));
  });
}

// Linhas adicionadas por arquivo, com o número da linha no arquivo novo, a partir de `git diff -U0`.
function addedLines(diff) {
  const out = [];
  let file = null, lineNo = 0;
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith("+++ ")) { file = raw.slice(4).replace(/^b\//, ""); if (file === "/dev/null") file = null; continue; }
    if (raw.startsWith("--- ")) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { lineNo = Number(hunk[1]); continue; }
    if (file && raw.startsWith("+")) { out.push({ file, line: lineNo, text: raw.slice(1) }); lineNo++; }
  }
  return out;
}

// [{ file, line, rule }] para cada segredo de formato conhecido nas linhas adicionadas.
function scanDiff(diff) {
  const found = [];
  for (const { file, line, text } of addedLines(diff)) {
    for (const hit of findSecrets(text)) found.push({ file, line, rule: hit.rule });
  }
  return found;
}

// Mesmo check do `npm run check`, limitado aos arquivos staged: sintaxe dos .js e validade dos .json.
function checkStaged(root, files) {
  const problems = [];
  for (const rel of files) {
    const file = path.join(root, rel);
    if (rel.endsWith(".js")) {
      const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (r.status !== 0) problems.push(`${rel}: ${(r.stderr || "").trim().split("\n").slice(0, 4).join(" | ")}`);
    } else if (rel.endsWith(".json")) {
      try { JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch (e) { problems.push(`${rel}: JSON inválido (${e.message})`); }
    }
  }
  return problems;
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} falhou: ${(r.stderr || "").trim()}`);
  return r.stdout;
}

function main() {
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  process.chdir(root);
  const problems = [];

  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).split("\0").filter(Boolean);
  for (const f of staged) { const why = forbiddenPath(f); if (why) problems.push(`${f}: ${why}`); }

  for (const s of scanDiff(git(["diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR"]))) {
    problems.push(`${s.file}:${s.line}: parece ${s.rule} (se for exemplo, acrescente "allow-secret" num comentário da linha)`);
  }
  const added = git(["diff", "--cached", "--name-only", "--diff-filter=A", "-z"]).split("\0").filter(Boolean);
  const mapaTouched = git(["diff", "--cached", "--name-only", "-z"]).split("\0").some(isMapFile);
  const mapaText = readMapaText();
  for (const f of missingFromMapa(added, mapaText, mapaTouched)) problems.push(`${f}: arquivo novo fora do mapa (atualize docs/mapa/ ou o MAPA.md no mesmo commit)`);
  if (problems.length) {
    console.error("✖ commit barrado:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }

  const checkProblems = checkStaged(root, staged);
  if (checkProblems.length) {
    console.error("✖ check dos arquivos staged falhou:\n" + checkProblems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }

  if (process.env.HARNESS_SKIP_TESTS === "1") {
    console.log("(testes pulados: HARNESS_SKIP_TESTS=1)");
    return;
  }

  const affected = affectedTests(staged);
  if (affected.docsOnly) {
    console.log("(testes pulados: commit só de documentação)");
    return;
  }
  if (!affected.tests.length) {
    console.log("(nenhum teste afetado)");
    return;
  }
  if (affected.unmatched.length) console.log(`(sem mapa: ${affected.unmatched.join(", ")}; rodando contrato fixo)`);
  console.log(`(testes afetados: ${affected.tests.length})`);
  const r = spawnSync(process.execPath, ["--test", ...affected.tests], { stdio: "inherit" });
  if (r.status !== 0) { console.error("✖ testes afetados falharam"); process.exit(1); }
}

module.exports = { isMapFile, missingFromMapa, forbiddenPath, addedLines, scanDiff, checkStaged };
if (require.main === module) main();

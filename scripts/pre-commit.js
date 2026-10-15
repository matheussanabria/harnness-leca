#!/usr/bin/env node
// Hook de pre-commit (ativar com: npm run setup:hooks). Barra o commit quando:
//   1. entra um arquivo que é dado local (projects/, global/*.md e .env, bridge/): o .gitignore já os exclui, isto pega o `git add -f`;
//   2. uma linha ADICIONADA tem um segredo de formato conhecido (chave de API, JWT, webhook, chave privada...).
//      Exemplos e fixtures: ponha "allow-secret" num comentário da mesma linha;
//   3. `npm run check` ou `npm test` falham (pule os testes com HARNESS_SKIP_TESTS=1, ex.: commit só de documentação).
// Nunca imprime o segredo achado: só arquivo, linha e tipo.
const { spawnSync } = require("child_process");
const path = require("path");
const { findSecrets } = require("../tools/lib/redact");

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
  if (problems.length) {
    console.error("✖ commit barrado:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }

  const run = (label, script) => {
    const r = spawnSync(process.execPath, [path.join(root, ...script)], { stdio: "inherit" });
    if (r.status !== 0) { console.error(`✖ ${label} falhou`); process.exit(1); }
  };
  run("npm run check", ["scripts", "check.js"]);
  if (process.env.HARNESS_SKIP_TESTS === "1") console.log("(testes pulados: HARNESS_SKIP_TESTS=1)");
  else {
    const r = spawnSync(process.execPath, ["--test", "tests/*.test.js"], { stdio: "inherit" });
    if (r.status !== 0) { console.error("✖ npm test falhou"); process.exit(1); }
  }
}

module.exports = { forbiddenPath, addedLines, scanDiff };
if (require.main === module) main();

#!/usr/bin/env node
// @ts-check
// Suíte de regressão do harness (EP-11.05): o conjunto mínimo que precisa estar verde
// antes de qualquer commit.
//
//   node scripts/regressao.js
//
// Roda, em ordem:
//   1. npm run check        sintaxe de todo o .js e validade dos .json
//   2. npm test             suíte de testes do repositório
//   3. verify-index         índice mestre coerente (links, contagens e totais)
//   4. types-baseline       dívida de tipos não pode ter crescido
//
// Cada etapa para a cadeia na primeira falha, com o nome da etapa no relatório.
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

/**
 * @param {string} label
 * @param {string[]} args
 * @returns {{ ok: boolean, code: number }}
 */
function run(label, args) {
  const started = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
  const code = r.status ?? 1;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${code === 0 ? "OK  " : "FALHA"} ${label} (${seconds}s)`);
  return { ok: code === 0, code };
}

/**
 * @returns {{ ok: boolean, steps: { label: string, ok: boolean }[] }}
 */
function runRegression() {
  const steps = [
    { label: "check (sintaxe e JSON)", args: [path.join(ROOT, "scripts", "check.js")] },
    { label: "test (suíte do repositório)", args: ["--test", "tests/*.test.js"] },
    { label: "verify-index (índice mestre)", args: [path.join(ROOT, "tools", "verify-index.js")] },
    { label: "types-baseline (dívida de tipos)", args: [path.join(ROOT, "tools", "types-baseline.js")] },
  ];

  const results = [];
  for (const step of steps) {
    const result = run(step.label, step.args);
    results.push({ label: step.label, ok: result.ok });
    if (!result.ok) break;
  }

  const ok = results.every((item) => item.ok);
  console.log(ok ? "\nRegressão verde." : "\nRegressão vermelha.");
  return { ok, steps: results };
}

module.exports = { runRegression };

if (require.main === module) {
  const result = runRegression();
  process.exit(result.ok ? 0 : 1);
}

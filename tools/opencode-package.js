#!/usr/bin/env node
// @ts-check
// Executa uma história do EP-14 com o opencode, num git worktree próprio (branch ep14/<id>-<slug>).
//   node tools/opencode-package.js 14.01                      cria o worktree e roda o agente (modelo gratuito)
//   node tools/opencode-package.js 14.01 --dry-run            só prepara o worktree, a configuração e o prompt
//   node tools/opencode-package.js 14.01 --verify             confere se o worktree só tocou nos arquivos permitidos
//   opções: --base <branch> (padrão ep14/integracao)  --model <provedor/modelo>  --allow-paid  --timeout-min <n>
// O executor nunca commita nem faz merge: o worktree volta para revisão.
const { ROOT } = require("./lib/root");
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const { runPackage, verifyStory } = require("./lib/opencode-package/run");

function main(argv, io) {
  const id = argv.find((a) => /^\d{2}\.\d{2}$/.test(a));
  if (!id) throw new CliError("Informe a história (ex.: 14.01). Uso: node tools/opencode-package.js 14.01 [--dry-run|--verify]");
  try {
    if (flag("verify", argv)) {
      const r = verifyStory(ROOT, id);
      io.log(JSON.stringify(r, null, 2));
      if (r.violations.length) throw new CliError(`${r.violations.length} arquivo(s) fora da lista permitida.`, 2);
      return;
    }
    const report = runPackage(ROOT, {
      id,
      base: opt("base", argv),
      model: opt("model", argv),
      allowPaid: flag("allow-paid", argv),
      dryRun: flag("dry-run", argv),
      timeoutMin: opt("timeout-min", argv) ? Number(opt("timeout-min", argv)) : undefined,
    });
    io.log(JSON.stringify(report, null, 2));
    if (!report.ok) throw new CliError("Execução com problemas: veja o relatório acima.", 2);
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(String(/** @type {Error} */ (err).message));
  }
}

module.exports = { main };
if (require.main === module) runAsScript(main);

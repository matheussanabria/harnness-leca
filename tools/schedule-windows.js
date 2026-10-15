#!/usr/bin/env node
// Liga (ou desliga) a execução automática das rotinas no Agendador de Tarefas do Windows: uma tarefa que, a cada hora,
// roda `tools/run-scheduled.js --log`, e este só executa o que venceu. Por padrão só MOSTRA o comando; mexer no
// agendador do sistema exige --apply, e é você quem decide.
//
//   node tools/schedule-windows.js              mostra o que seria criado
//   node tools/schedule-windows.js --apply      cria/atualiza a tarefa (roda com o seu usuário, só com a sessão aberta)
//   node tools/schedule-windows.js --status     mostra se a tarefa existe
//   node tools/schedule-windows.js --remove     apaga a tarefa
const path = require("path");
const { spawnSync } = require("child_process");
const { flag } = require("./lib/cli");

const TASK = "HarnessLeca-Rotinas";
const RUNNER = path.resolve(__dirname, "run-scheduled.js");
const SCHTASKS = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "schtasks.exe");

// Argumentos do schtasks (lista, sem shell). O /TR é UM argumento: "<node>" "<script>" --log.
function createArgs(node = process.execPath, runner = RUNNER) {
  const tr = `"${node}" "${runner}" --log`;
  if (tr.length > 255) throw new Error("O comando passa de 255 caracteres (limite do /TR do Agendador); mova o projeto para um caminho mais curto.");
  return ["/Create", "/TN", TASK, "/SC", "HOURLY", "/TR", tr, "/F"];
}

function main() {
  if (process.platform !== "win32") { console.error("Este instalador é só para Windows. Em Linux/macOS, agende `node tools/run-scheduled.js --log` no cron/launchd, de hora em hora."); process.exit(1); }
  const run = (args) => spawnSync(SCHTASKS, args, { encoding: "utf8", shell: false, windowsHide: true });
  const show = (r) => { if (r.stdout) console.log(r.stdout.trim()); if (r.stderr) console.error(r.stderr.trim()); return r.status === 0; };

  if (flag("status")) process.exit(show(run(["/Query", "/TN", TASK, "/FO", "LIST"])) ? 0 : 1);
  if (flag("remove")) process.exit(show(run(["/Delete", "/TN", TASK, "/F"])) ? 0 : 1);

  const args = createArgs();
  console.log(`${path.basename(SCHTASKS)} ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`);
  if (!flag("apply")) { console.log("\nNada foi criado. Para criar a tarefa: node tools/schedule-windows.js --apply"); return; }
  process.exit(show(run(args)) ? 0 : 1);
}

module.exports = { createArgs, TASK };
if (require.main === module) main();

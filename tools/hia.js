#!/usr/bin/env node
// @ts-check
const { opt, CliError, runAsScript } = require("./lib/cli");
const { listTools, getTool } = require("./lib/hia/registry");
const { executeTool } = require("./lib/hia/executor");

async function run(argv, io = console) {
  const command = argv[0] || "list";

  if (command === "list") {
    const tools = listTools();
    io.log(`Automation Registry: ${tools.length} ferramentas disponiveis.`);
    for (const t of tools) {
      io.log(`- [${t.category}] ${t.id} (${t.name}) - timeout: ${t.timeoutMs}ms`);
    }
    return;
  }

  if (command === "info") {
    const toolId = argv[1];
    if (!toolId) throw new CliError("Informe o id da ferramenta. Exemplo: node tools/hia.js info git.status");
    const tool = getTool(toolId);
    if (!tool) throw new CliError(`Ferramenta '${toolId}' nao encontrada.`);
    const { handler, ...meta } = tool;
    io.log(JSON.stringify(meta, null, 2));
    return;
  }

  if (command === "run") {
    const toolId = argv[1];
    if (!toolId) throw new CliError("Informe o id da ferramenta. Exemplo: node tools/hia.js run git.status");
    let args = {};
    const rawArgs = opt("args", argv);
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs);
      } catch (e) {
        throw new CliError(`Argumento --args deve ser JSON valido: ${e.message}`);
      }
    }
    const res = await executeTool(toolId, args);
    if (!res.ok) {
      io.error(`Falha ao executar ${toolId} (${res.durationMs}ms): [${res.error?.code}] ${res.error?.message}`);
      process.exitCode = 1;
      return;
    }
    io.log(`[OK] ${toolId} concluido em ${res.durationMs}ms:`);
    io.log(JSON.stringify(res.data, null, 2));
    return;
  }

  throw new CliError(`Comando desconhecido: '${command}'. Comandos validos: list, info, run.`);
}

module.exports = { run };
if (require.main === module) runAsScript(run);

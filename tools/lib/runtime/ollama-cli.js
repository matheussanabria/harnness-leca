#!/usr/bin/env node
// @ts-check
// Runner síncrono para o motor local (Ollama) usado por `tools/lib/llm.js`.
// Lê o prompt no stdin, chama o daemon local e escreve a resposta em texto no stdout.
// Existe porque `ask()` é síncrono por legado de CLI, enquanto o cliente HTTP é assíncrono.

const { generateText } = require("./ollama-client");

/**
 * @param {string[]} argv
 * @returns {string}
 */
function readModel(argv) {
  const idx = argv.indexOf("--model");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return "qwen3.5:4b";
}

async function main() {
  const prompt = require("fs").readFileSync(0, "utf8");
  if (!prompt.trim()) {
    throw new Error("Prompt vazio para o motor local.");
  }
  // O piso de RAM é configurável para máquinas com menos memória livre; o padrão é o da CLI.
  const minFreeMemMb = Number(process.env.OLLAMA_MIN_FREE_MB) || 1000;
  const res = await generateText({
    prompt,
    model: readModel(process.argv.slice(2)),
    temperature: 0.1,
    numPredict: 1024,
    numCtx: 4096,
    think: false,
    minFreeMemMb,
  });
  process.stdout.write(res.raw);
}

main().catch((err) => {
  process.stderr.write(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

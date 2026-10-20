// @ts-check
const fs = require("fs");
const path = require("path");
const { getHardwareSnapshot } = require("./hardware-profiler");

const FIXTURES_DIR = path.resolve(__dirname, "../../../tests/fixtures/benchmark");

/**
 * Carrega dataset versionado de benchmark
 * @param {string} datasetName
 */
function loadDataset(datasetName) {
  const file = path.join(FIXTURES_DIR, `${datasetName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Dataset '${datasetName}' não encontrado em ${FIXTURES_DIR}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Avalia capacidade do hardware e executa bateria de validação de dataset
 * @param {{
 *   datasetName: string,
 *   model?: string,
 *   ollamaUrl?: string
 * }} options
 */
async function runBenchmark({ datasetName, model = "qwen2.5-coder:1.5b", ollamaUrl = "http://localhost:11434" }) {
  const hw = getHardwareSnapshot();
  const dataset = loadDataset(datasetName);

  const result = {
    timestamp: new Date().toISOString(),
    dataset: dataset.name,
    totalCases: dataset.cases.length,
    hardware: {
      cpu: hw.cpu.model,
      threads: hw.cpu.recommendedThreads,
      freeRamMb: hw.memory.freeMb,
      viable: hw.viable,
    },
    model,
    results: [],
    skipped: false,
    reason: null,
  };

  if (!hw.viable) {
    result.skipped = true;
    result.reason = hw.alert || "Hardware com pouca RAM livre para benchmark.";
    return result;
  }

  // Verifica disponibilidade do Ollama
  let available = false;
  try {
    const ping = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(1000) });
    available = ping.ok;
  } catch {}

  if (!available) {
    result.skipped = true;
    result.reason = `Ollama daemon inacessível em ${ollamaUrl}. Execute 'ollama serve' para rodar este benchmark.`;
    return result;
  }

  return result;
}

module.exports = {
  loadDataset,
  runBenchmark,
};

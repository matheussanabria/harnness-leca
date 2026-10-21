// @ts-check
// Ollama Adapter HTTP Client — Local AI Runtime (EP-01)
// Conexão síncrona/estruturada e health check contra localhost:11434 com proteção de memória e timeout.

const { loadEnv } = require("../env");
const { getMemoryProfile } = require("../hia/hardware-profiler");

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const LOCAL_HOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Valida se uma URL é estritamente de destino local seguro
 * @param {string} urlString
 * @returns {boolean}
 */
function isLocalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return LOCAL_HOST_PATTERN.test(parsed.origin);
  } catch {
    return false;
  }
}

/**
 * Retorna a URL base do daemon Ollama validada
 * @returns {string}
 */
function getBaseUrl() {
  loadEnv();
  const configured = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
  if (!isLocalUrl(configured)) {
    throw new Error(`Destino do Ollama não autorizado ou não local: '${configured}'`);
  }
  return configured.replace(/\/+$/, "");
}

/**
 * Verifica o status e disponibilidade do daemon Ollama
 * @param {number} [timeoutMs=1500]
 * @returns {Promise<{ ok: boolean, version?: string, error?: string }>}
 */
async function checkHealth(timeoutMs = 1500) {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, version: data.version || "unknown" };
    }

    // Fallback de ping para /api/tags caso /api/version não responda 200
    const tagsRes = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);

    if (tagsRes && tagsRes.ok) {
      return { ok: true };
    }

    return { ok: false, error: "Daemon offline ou não responsivo" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Lista modelos instalados no daemon local Ollama
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<Array<{ name: string, sizeMb: number }>>}
 */
async function listInstalledModels(timeoutMs = 2000) {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.models)) return [];
    return data.models.map((m) => ({
      name: m.name,
      sizeMb: m.size ? Math.round(m.size / (1024 * 1024)) : 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Executa inferência não-streaming para geração estruturada (JSON)
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.system]
 * @param {string} [params.model="qwen3.5:4b"]
 * @param {number} [params.temperature=0.1]
 * @param {number} [params.numPredict=256]
 * @param {number} [params.numCtx=2048]
 * @param {string} [params.keepAlive="5m"]
 * @param {boolean} [params.think=false]
 * @param {AbortSignal} [params.signal]
 * @param {number} [params.minFreeMemMb=2500]
 */
async function generateStructured({
  prompt,
  system,
  model = "qwen3.5:4b",
  temperature = 0.1,
  numPredict = 256,
  numCtx = 2048,
  keepAlive = "5m",
  think = false,
  signal,
  minFreeMemMb = 2500,
}) {
  const res = await request({
    prompt,
    system,
    model,
    temperature,
    numPredict,
    numCtx,
    keepAlive,
    think,
    signal,
    minFreeMemMb,
    format: "json",
  });

  const rawResponse = res.rawResponse;
  let parsed = null;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (err) {
    throw new Error(`Falha ao converter resposta da LLM para JSON: ${err.message}. Raw: ${rawResponse}`);
  }

  return { data: parsed, raw: rawResponse, metrics: res.metrics };
}

/**
 * Executa inferência não-streaming com resposta em texto livre (sem `format: json`)
 * Usado por fluxos que pedem Markdown, como a extração de artefatos.
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.system]
 * @param {string} [params.model="qwen3.5:4b"]
 * @param {number} [params.temperature=0.1]
 * @param {number} [params.numPredict=512]
 * @param {number} [params.numCtx=4096]
 * @param {string} [params.keepAlive="5m"]
 * @param {boolean} [params.think=false]
 * @param {AbortSignal} [params.signal]
 * @param {number} [params.minFreeMemMb=2500]
 */
async function generateText({
  prompt,
  system,
  model = "qwen3.5:4b",
  temperature = 0.1,
  numPredict = 512,
  numCtx = 4096,
  keepAlive = "5m",
  think = false,
  signal,
  minFreeMemMb = 2500,
}) {
  const res = await request({
    prompt,
    system,
    model,
    temperature,
    numPredict,
    numCtx,
    keepAlive,
    think,
    signal,
    minFreeMemMb,
  });

  return { raw: res.rawResponse, metrics: res.metrics };
}

/**
 * Executa a requisição ao daemon Ollama e devolve resposta bruta + métricas
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.system]
 * @param {string} params.model
 * @param {number} params.temperature
 * @param {number} params.numPredict
 * @param {number} params.numCtx
 * @param {string} params.keepAlive
 * @param {boolean} params.think
 * @param {AbortSignal} [params.signal]
 * @param {number} params.minFreeMemMb
 * @param {string} [params.format]
 */
async function request({
  prompt,
  system,
  model,
  temperature,
  numPredict,
  numCtx,
  keepAlive,
  think,
  signal,
  minFreeMemMb,
  format,
}) {
  const mem = getMemoryProfile();
  if (mem.freeMb < minFreeMemMb) {
    throw new Error(
      `Memória RAM livre insuficiente (${mem.freeMb} MB). Requer mínimo de ${minFreeMemMb} MB para inferência local segura.`
    );
  }

  const base = getBaseUrl();
  const payload = {
    model,
    prompt,
    system,
    stream: false,
    keep_alive: keepAlive,
    options: {
      temperature,
      num_predict: numPredict,
      num_ctx: numCtx,
    },
  };

  if (format) payload.format = format;
  if (think === false) {
    payload.think = false;
  }

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Modelo '${model}' não encontrado no daemon Ollama.`);
    }
    throw new Error(`Ollama retornou HTTP ${res.status}: ${res.statusText}`);
  }

  const result = await res.json();
  const metrics = {
    model: result.model || model,
    totalDurationMs: result.total_duration ? Math.round(result.total_duration / 1e6) : 0,
    loadDurationMs: result.load_duration ? Math.round(result.load_duration / 1e6) : 0,
    promptDurationMs: result.prompt_eval_duration ? Math.round(result.prompt_eval_duration / 1e6) : 0,
    evalDurationMs: result.eval_duration ? Math.round(result.eval_duration / 1e6) : 0,
    tokensPrompt: result.prompt_eval_count || 0,
    tokensGenerated: result.eval_count || 0,
  };

  return { rawResponse: result.response || "", metrics };
}

module.exports = {
  isLocalUrl,
  getBaseUrl,
  checkHealth,
  listInstalledModels,
  generateStructured,
  generateText,
};

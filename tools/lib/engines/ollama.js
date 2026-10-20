// @ts-check
// Motor Local: Ollama (Daemon local REST em http://localhost:11434).
// Não consome cotas em nuvem. Opera em CPU com quantizações compactas (< 3 GB).
const { PublicError, safeModel, getProjectContext } = require("./common");
const { loadEnv } = require("../env");
const { getCpuProfile, getMemoryProfile } = require("../hia/hardware-profiler");

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

const baseUrl = () => {
  loadEnv();
  return process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
};

/**
 * Faz streaming de resposta a partir do daemon Ollama local via /api/generate
 * @param {import("../types").EngineRequest} req
 */
async function streamOllama({ prompt, slug, model, effort, daiAgent, signal, onChunk, onDone, onError }) {
  const base = baseUrl();
  try {
    const mem = getMemoryProfile();
    if (!mem.safeForInference) {
      throw new PublicError(
        `Memória RAM livre insuficiente (${mem.freeMb} MB). O motor local Ollama requer ao menos 3000 MB livres para evitar travamentos.`
      );
    }

    const cpu = getCpuProfile();
    model = safeModel(model) || "qwen2.5-coder:1.5b";

    let fullPrompt = prompt;
    if (effort === "low") {
      fullPrompt = `[Responda de forma concisa e direta]\n\n${fullPrompt}`;
    } else if (effort === "high") {
      fullPrompt = `[Analise detalhadamente antes de responder]\n\n${fullPrompt}`;
    }

    const ctx = getProjectContext(slug, { daiAgent });
    if (ctx) {
      fullPrompt = `${ctx}\n\nInstrução do usuário:\n${fullPrompt}`;
    }

    const payload = {
      model,
      prompt: fullPrompt,
      stream: true,
      options: {
        num_thread: cpu.recommendedThreads,
        temperature: 0.2,
      },
    };

    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new PublicError(
          `Modelo local '${model}' não encontrado no Ollama. Execute 'ollama pull ${model}' no terminal para baixá-lo.`
        );
      }
      throw new PublicError(`Ollama retornou HTTP ${res.status}: ${res.statusText}`);
    }

    if (!res.body) {
      throw new PublicError("Resposta sem corpo recebida do Ollama");
    }

    let fullText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.response) {
            fullText += parsed.response;
            onChunk({ type: "text", text: parsed.response, sessionId: "ollama-local" });
          }
          if (parsed.done) {
            onDone({ sessionId: "ollama-local", fullText });
            return;
          }
        } catch {}
      }
    }

    onDone({ sessionId: "ollama-local", fullText });
  } catch (err) {
    if (err && err.name === "AbortError") {
      return;
    }
    onError(err);
  }
}

/**
 * Obtém modelos instalados localmente no daemon Ollama
 * @param {string} base
 */
async function fetchLocalModels(base) {
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body.models) || !body.models.length) return null;
    return body.models.map((m) => {
      const sizeMb = m.size ? Math.round(m.size / (1024 * 1024)) : 0;
      return {
        id: m.name,
        name: m.name,
        desc: sizeMb ? `Local (${sizeMb} MB)` : "Modelo local Ollama",
      };
    });
  } catch {
    return null;
  }
}

/**
 * Retorna o status de disponibilidade do Ollama
 * @param {import("../types").EngineCatalogEntry} catalogEntry
 */
async function status(catalogEntry) {
  const base = baseUrl();
  let available = false;
  try {
    const ping = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(1500) });
    available = ping.ok;
  } catch {}

  const installedModels = available ? await fetchLocalModels(base) : null;
  const models = installedModels && installedModels.length > 0 ? installedModels : catalogEntry.models;

  return {
    available,
    url: base,
    auth: available ? "Daemon local ativo (CPU)" : "Ollama desligado (execute 'ollama serve')",
    defaultModel: models[0]?.id || catalogEntry.defaultModel,
    models,
  };
}

/** @type {import("../types").Engine} */
const engine = {
  id: "ollama",
  stream: streamOllama,
  status,
};

module.exports = engine;

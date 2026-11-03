// @ts-check
// Motor 3: Gemini / Antigravity.
// Prioriza o Antigravity CLI nativo (agy) para usar a assinatura ativa do usuário sem custo de API.
// Em fallback, consome a API do Google AI Studio com chave em global/.env (GEMINI_API_KEY).
const crypto = require("crypto");
const { loadEnv } = require("../env");
const { safeModel, getProjectContext, PublicError } = require("./common");
const { resolveAgyBin } = require("../antigravity-bin");
const { streamAntigravity } = require("./antigravity-stream");

/**
 * Fallback via Google AI Studio REST SSE API
 * @param {string} key
 * @param {import("../types").EngineRequest} req
 */
async function streamAiStudio(key, req) {
  const { prompt, slug, sessionId, history, model, effort, daiAgent, signal, onChunk, onDone, onError } = req;
  const sid = typeof sessionId === "string" && /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : crypto.randomUUID();

  try {
    const ctx = getProjectContext(slug, { daiAgent });
    const targetModel = safeModel(model) || "gemini-3.8-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`;

    const past = (Array.isArray(history) ? history : [])
      .filter((t) => t && typeof t.text === "string" && t.text.trim())
      .slice(-40)
      .map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] }));

    const tempVal = effort === "low" ? 0.2 : effort === "high" ? 1.0 : 0.7;
    const body = {
      contents: [...past, { role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: tempVal,
        maxOutputTokens: 8192,
      },
    };
    if (ctx) {
      body.system_instruction = { parts: [{ text: `Você é o assistente Gemini do Harness Leca.\n${ctx}` }] };
    }

    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 503 && targetModel === "gemini-3.8-flash") {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:streamGenerateContent?alt=sse`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal,
      });
      if (fallbackRes.ok) res = fallbackRes;
    }

    if (!res.ok) {
      const errText = (await res.text()).split(key).join("[REDIGIDO]");
      throw new Error(`Google Gemini API retornou HTTP ${res.status}: ${errText}`);
    }

    let accumulatedText = "";
    let accumulatedThinking = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const cand = parsed.candidates && parsed.candidates[0];
          if (cand && cand.content && Array.isArray(cand.content.parts)) {
            for (const part of cand.content.parts) {
              if (part.thought) {
                accumulatedThinking += part.text || "";
                onChunk({ type: "thinking", text: part.text, sessionId: sid });
              } else if (part.text) {
                accumulatedText += part.text;
                onChunk({ type: "text", text: part.text, sessionId: sid });
              }
            }
          }
        } catch {}
      }
    }

    onDone({ sessionId: sid, fullText: accumulatedText, thinking: accumulatedThinking });
  } catch (err) {
    onError(err);
  }
}

/** @param {import("../types").EngineRequest} req */
async function streamGemini(req) {
  loadEnv();
  const bin = resolveAgyBin();
  if (bin) {
    return streamAntigravity(bin, req);
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (key) {
    return streamAiStudio(key, req);
  }

  req.onError(
    new PublicError(
      "Antigravity CLI (agy) não encontrado e chave GEMINI_API_KEY não configurada. Defina AGY_BIN ou GEMINI_API_KEY em global/.env para conversar com o Gemini."
    )
  );
}

/** @type {import("../types").Engine} */
const engine = {
  id: "gemini",
  stream: streamGemini,
  status: async (catalog) => {
    loadEnv();
    const bin = resolveAgyBin();
    const hasAgy = Boolean(bin);
    const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const auth = hasKey
      ? catalog._authComChave
      : (hasAgy ? catalog.auth : (catalog._authBridge || catalog.auth));
    return {
      available: hasAgy || hasKey || true,
      hasKey,
      hasAgy,
      auth,
    };
  },
};

module.exports = engine;

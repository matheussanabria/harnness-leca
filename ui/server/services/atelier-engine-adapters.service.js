// @ts-check
// Adaptadores de Motores (Gemini, OpenCode) para o Atelier Agent Loop (EP-15.04).
// Formata histórico com tool-calls/results e extrai respostas estruturadas.
const { getGeminiFunctionDeclarations, getOpenCodeTools } = require("./atelier-tools.service");

/**
 * Converte o histórico do AgentLoop para o formato contents da API do Gemini.
 * @param {Array<import("./atelier-agent-loop.service").AgentLoopMessage>} history
 */
function formatGeminiContents(history) {
  const contents = [];

  for (const msg of history) {
    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.text || "" }] });
    } else if (msg.role === "model") {
      const parts = [];
      if (msg.text) parts.push({ text: msg.text });
      if (Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.args || {} } });
        }
      }
      if (parts.length) contents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      const parts = [];
      if (Array.isArray(msg.toolResults)) {
        for (const tr of msg.toolResults) {
          parts.push({
            functionResponse: {
              name: tr.name,
              response: { name: tr.name, content: tr.result },
            },
          });
        }
      }
      if (parts.length) contents.push({ role: "function", parts });
    }
  }

  return contents;
}

/**
 * Converte o histórico do AgentLoop para o formato messages de APIs estilo OpenAI / OpenCode.
 * @param {Array<import("./atelier-agent-loop.service").AgentLoopMessage>} history
 * @param {string} [systemPrompt]
 */
function formatOpenCodeMessages(history, systemPrompt) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  for (const msg of history) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.text || "" });
    } else if (msg.role === "model") {
      const tool_calls = Array.isArray(msg.toolCalls)
        ? msg.toolCalls.map((tc, idx) => ({
            id: tc.id || `call_${idx}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
          }))
        : undefined;
      messages.push({ role: "assistant", content: msg.text || null, tool_calls });
    } else if (msg.role === "tool") {
      if (Array.isArray(msg.toolResults)) {
        for (const tr of msg.toolResults) {
          messages.push({
            role: "tool",
            name: tr.name,
            tool_call_id: tr.id || "call_0",
            content: typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result),
          });
        }
      }
    }
  }

  return messages;
}

/**
 * Extrai chamadas de ferramenta de uma resposta bruta do Gemini (parsed SSE chunks ou JSON).
 * @param {object} candidate
 * @returns {{ text: string, toolCalls: Array<{ name: string, args: object }> }}
 */
function parseGeminiCandidate(candidate) {
  let text = "";
  const toolCalls = [];

  const parts = candidate?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part.text && !part.thought) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }
  }

  return { text, toolCalls };
}

/**
 * Fallback resiliente: extrai chamadas estruturadas de blocos <ferramenta nome="..."> ou blocos json
 * caso modelos menores ou sem tool-use nativo cuspar no texto.
 * @param {string} rawText
 * @returns {{ text: string, toolCalls: Array<{ name: string, args: object }> }}
 */
function parseStructuredToolCallsFallback(rawText) {
  if (!rawText || typeof rawText !== "string") return { text: "", toolCalls: [] };

  const toolCalls = [];
  let cleanedText = rawText;

  // 1. Extração de blocos <tool name="...">...</tool> ou <ferramenta nome="...">...</ferramenta>
  const tagRegex = /<\s*(?:tool|ferramenta)\s+(?:name|nome)\s*=\s*["']([^"']+)["']\s*>(.*?)<\/\s*(?:tool|ferramenta)\s*>/gis;
  let match;
  while ((match = tagRegex.exec(rawText)) !== null) {
    const name = match[1].trim();
    let body = match[2].trim();
    // Limpa possível invólucro de código markdown ```json ... ```
    body = body.replace(/^\s*```[a-zA-Z0-9_-]*\r?\n/, "").replace(/\r?\n```\s*$/, "");
    try {
      const args = JSON.parse(body);
      toolCalls.push({ name, args });
    } catch {}
  }

  if (toolCalls.length > 0) {
    cleanedText = cleanedText.replace(tagRegex, "").trim();
  }

  return { text: cleanedText, toolCalls };
}

/**
 * Cria a função modelTurn para Gemini / Google AI Studio.
 * @param {object} config
 * @param {string} config.key
 * @param {string} [config.model]
 * @param {string} [config.systemInstruction]
 * @param {"low" | "medium" | "high"} [config.effort]
 * @param {typeof fetch} [config.fetchFn]
 */
function buildGeminiModelTurn({
  key,
  model = "gemini-3.8-flash",
  systemInstruction,
  effort = "medium",
  fetchFn = fetch,
}) {
  return async function geminiModelTurn(history, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const tempVal = effort === "low" ? 0.2 : effort === "high" ? 1.0 : 0.7;

    const body = {
      contents: formatGeminiContents(history),
      tools: [{ functionDeclarations: getGeminiFunctionDeclarations() }],
      generationConfig: {
        temperature: tempVal,
        maxOutputTokens: 8192,
      },
    };

    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parsed = parseGeminiCandidate(candidate);

    // Se não veio functionCall nativa, tenta o fallback no texto
    if (!parsed.toolCalls.length && parsed.text) {
      const fb = parseStructuredToolCallsFallback(parsed.text);
      if (fb.toolCalls.length) return fb;
    }

    return parsed;
  };
}

/**
 * Cria a função modelTurn para OpenCode local (REST).
 * @param {object} config
 * @param {string} [config.base]
 * @param {string} [config.model]
 * @param {string} [config.systemPrompt]
 * @param {"low" | "medium" | "high"} [config.effort]
 * @param {typeof fetch} [config.fetchFn]
 */
function buildOpenCodeModelTurn({
  base = "http://localhost:63186",
  model,
  systemPrompt,
  effort = "medium",
  fetchFn = fetch,
}) {
  return async function openCodeModelTurn(history, signal) {
    const url = `${base.replace(/\/$/, "")}/session`;
    const messages = formatOpenCodeMessages(history, systemPrompt);
    const tools = getOpenCodeTools();

    const body = {
      messages,
      tools,
      model,
      temperature: effort === "low" ? 0.2 : effort === "high" ? 1.0 : 0.7,
    };

    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenCode API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message || data.message || {};
    const text = message.content || "";
    const toolCalls = [];

    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        let args = {};
        try {
          args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {};
        } catch {}
        toolCalls.push({ name: tc.function?.name, args, id: tc.id });
      }
    }

    if (!toolCalls.length && text) {
      const fb = parseStructuredToolCallsFallback(text);
      if (fb.toolCalls.length) return fb;
    }

    return { text, toolCalls };
  };
}

module.exports = {
  formatGeminiContents,
  formatOpenCodeMessages,
  parseGeminiCandidate,
  parseStructuredToolCallsFallback,
  buildGeminiModelTurn,
  buildOpenCodeModelTurn,
};

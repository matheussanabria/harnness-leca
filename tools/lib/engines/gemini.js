// @ts-check
// Motor 3: Gemini (Google AI Studio com chave em global/.env; sem chave, grava na fila bridge/ do Antigravity).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("../root");
const { loadEnv } = require("../env");
const { safeModel, getProjectContext } = require("./common");

/** @param {import("../types").EngineRequest} req */
async function streamGemini({ prompt, slug, sessionId, history, model, effort, signal, onChunk, onDone, onError }) {
  loadEnv();
  // A chave vem só do .env: aceitá-la da requisição deixaria uma página forjada mandar o contexto do projeto para outra conta.
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  // A API do Gemini não guarda sessão: cada conversa ganha um id próprio, mantido pelo navegador entre os turnos.
  const sid = typeof sessionId === "string" && /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : crypto.randomUUID();

  if (!key) {
    // Se não tiver chave de API, grava na fila da Bridge local do Antigravity
    const bridgeDir = path.join(ROOT, "bridge");
    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });
    const item = {
      id: sid,
      data: new Date().toISOString(),
      slug,
      prompt,
      status: "recebido",
    };
    fs.appendFileSync(path.join(bridgeDir, "gemini-inbox.jsonl"), JSON.stringify(item) + "\n", "utf8");

    const note = `[✦ Modo Bridge Gemini/Antigravity]\n\nMensagem registrada na fila de processamento local (\`bridge/gemini-inbox.jsonl\`).\n\n💡 **Dica**: Para respostas instantâneas na tela do Gemini, adicione a chave do Google AI Studio em \`global/.env\` (\`GEMINI_API_KEY=...\`).`;
    onChunk({ type: "text", text: note, sessionId: item.id });
    return onDone({ sessionId: item.id, fullText: note });
  }

  try {
    const ctx = getProjectContext(slug);
    const targetModel = safeModel(model) || "gemini-3.8-flash";
    // A chave vai no header, não na URL (URLs aparecem em logs e mensagens de erro).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`;

    // Turnos anteriores da conversa (o navegador envia), para o Gemini não esquecer o que já foi dito.
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

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal, // cliente saiu: cancela a requisição e a leitura do stream
    });

    if (!res.ok) {
      const errText = (await res.text()).split(key).join("[REDIGIDO]");
      throw new Error(`Google Gemini API retornou HTTP ${res.status}: ${errText}`);
    }

    let accumulatedText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const cand = parsed.candidates && parsed.candidates[0];
          if (cand && cand.content && Array.isArray(cand.content.parts)) {
            for (const part of cand.content.parts) {
              if (part.text) {
                accumulatedText += part.text;
                onChunk({ type: "text", text: part.text, sessionId: sid });
              }
            }
          }
        } catch {}
      }
    }

    onDone({ sessionId: sid, fullText: accumulatedText });
  } catch (err) {
    onError(err);
  }
}

/** @type {import("../types").Engine} */
const engine = {
  id: "gemini",
  stream: streamGemini,
  status: async (catalog) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    return { available: true, hasKey, auth: hasKey ? catalog._authComChave : catalog.auth };
  },
};

module.exports = engine;

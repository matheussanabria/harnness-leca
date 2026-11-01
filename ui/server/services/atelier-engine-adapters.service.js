// @ts-check
// Adaptadores de Motores (Gemini, OpenCode) para o Atelier Agent Loop (EP-15.04).
// Formata histórico com tool-calls/results e extrai respostas estruturadas.
const { getGeminiFunctionDeclarations, getOpenCodeTools } = require("./atelier-tools.service");
const { parseToolTags } = require("./atelier-tool-tags.service");
const { NAV_RULES } = require("./atelier-nav-contract.service");
const V2 = require("../../../tools/lib/opencode-v2");
const { runTurn, TurnError } = require("../../../tools/lib/opencode-v2-turn");
const { ocFetch } = require("../../../tools/lib/opencode-detect");

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
 * @returns {{ text: string, toolCalls: Array<{ name: string, args: object }>, errors: Array<{ tool: string, reason: string }> }}
 */
function parseStructuredToolCallsFallback(rawText) {
  return parseToolTags(rawText);
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
 * O agente padrão do opencode tem ferramentas nativas de escrita e roda na pasta do harness: sem isto o modelo grava
 * arquivos soltos no repositório (já aconteceu: prototype/index.html, 72 KB) em vez de emitir as tags do Ateliê.
 * Leitura continua liberada (Design System, arquivos do projeto). Medido: negar só write/edit/bash não basta, o modelo
 * contorna com a ferramenta "shell"; com esta lista completa o arquivo não é criado.
 */
const NO_NATIVE_WRITES = ["write", "edit", "multiedit", "patch", "apply_patch", "shell", "bash"].map((action) => ({ action, resource: "*", effect: "deny" }));

/**
 * Cria a função modelTurn para OpenCode local (API HTTP v2).
 * @param {object} config
 * @param {string} [config.base]
 * @param {string} [config.model]
 * @param {string} [config.sessionId] sessão do opencode a retomar (guarda o histórico da conversa)
 * @param {string} [config.systemPrompt]
 * @param {"low" | "medium" | "high"} [config.effort]
 * @param {typeof fetch} [config.fetchFn]
 */
function buildOpenCodeModelTurn({
  base = "http://localhost:63186",
  model,
  sessionId,
  systemPrompt,
  effort = "medium",
  fetchFn = ocFetch,
}) {
  let cachedSessionId = /^ses_[A-Za-z0-9]{1,64}$/.test(sessionId || "") ? sessionId : null;
  let checked = false;

  return async function openCodeModelTurn(history, signal, /** @type {(e: object) => void} */ emit = () => {}) {
    const cleanBase = base.replace(/\/$/, "");

    // 1. Garante sessão ativa (API v2: o modelo é definido na criação da sessão)
    const reqOpts = { signal, fetchFn };
    if (cachedSessionId && !checked) {
      // Sessão vinda da conversa anterior: confere que o servidor ainda a conhece e aplica o modelo escolhido agora.
      try {
        if (model) await V2.setSessionModel(cleanBase, cachedSessionId, model, reqOpts);
        await V2.readTurn(cleanBase, cachedSessionId, Number.MAX_SAFE_INTEGER, reqOpts);
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        cachedSessionId = null; // sessão perdida (servidor reiniciado): começa outra
      }
    }
    checked = true;
    if (!cachedSessionId) cachedSessionId = await V2.createSession(cleanBase, { model, permissions: NO_NATIVE_WRITES }, reqOpts);
    emit({ type: "session", sessionId: cachedSessionId }); // o cliente guarda o id e o reenvia na próxima mensagem

    // 2. Prepara o prompt do último turno com instrução das ferramentas
    const lastMsg = history[history.length - 1];
    let userText = lastMsg?.text || "";
    if (lastMsg?.role === "tool" && Array.isArray(lastMsg.toolResults)) {
      userText = `Resultados das ferramentas executadas:\n${JSON.stringify(lastMsg.toolResults, null, 2)}\n\nContinue a execução do protótipo chamando a próxima ferramenta ou concluindo.`;
    }

    const toolInstruction = `Você é o gerador de código e design do Ateliê.
Sua única responsabilidade é emitir tags estruturadas que o backend do Ateliê intercepta e grava nos arquivos do protótipo:
- Para definir o plano: <tool name="atelier_plan">{"steps":[{"id":"1","title":"...","status":"in_progress"}]}</tool>
- Para gerar o HTML da tela, escreva o HTML CRU no corpo da tag, SEM JSON e SEM escapes: <tool name="atelier_write_screen" screenId="home"><main>...</main></tool>
- Para aplicar CSS, também CRU no corpo: <tool name="atelier_patch_styles" mode="append">.card { padding: 16px; }</tool>
- Para fazer perguntas necessárias: <tool name="atelier_ask_user">{"question":"...","options":["A","B"]}</tool>
- Para finalizar: <tool name="atelier_complete">{"summary":"..."}</tool>
${NAV_RULES}
IMPORTANTE: Não tente usar bash, grep ou ferramentas do terminal. Não se preocupe com modo somente leitura: apenas emita as tags acima no texto da sua resposta e o sistema gravará o código. Prossiga imediatamente com a implementação.`;

    const fullPrompt = `${toolInstruction}\n\n${userText}`;

    // 3. Turno com streaming (eventos da API v2): o raciocínio sai em tempo real, igual à CLI nativa
    let turn;
    try {
      turn = await runTurn(cleanBase, cachedSessionId, fullPrompt, {
        signal,
        fetchFn,
        onReasoning: (text) => emit({ type: "thinking", text }),
        onWaiting: (seconds) => emit({ type: "waiting", seconds }),
      });
    } catch (err) {
      if (err instanceof TurnError) throw new Error(err.message);
      throw err;
    }
    const accumulatedText = turn.text;

    const parsed = parseStructuredToolCallsFallback(accumulatedText);
    // Tag que não deu para ler vira erro devolvido ao modelo (que reenvia), em vez de sumir e a tela ficar vazia.
    const errorCalls = parsed.errors.map((e) => ({ name: "atelier_parse_error", args: { tool: e.tool, reason: e.reason } }));
    return { text: parsed.text || accumulatedText, toolCalls: [...parsed.toolCalls, ...errorCalls] };
  };
}

module.exports = {
  formatGeminiContents,
  formatOpenCodeMessages,
  parseGeminiCandidate,
  parseStructuredToolCallsFallback,
  buildGeminiModelTurn,
  buildOpenCodeModelTurn,
  NO_NATIVE_WRITES,
};

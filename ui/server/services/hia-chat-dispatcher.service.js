// @ts-check
// Despachante inteligente de chat: avalia a rota (Script-First / Local-First / Cloud)
// e executa localmente quando determinístico, preservando cotas dos provedores em nuvem.
const { routeTask } = require("../../../tools/lib/hia/router");
const { executeTool } = require("../../../tools/lib/hia/executor");
const { recordExecution } = require("../../../tools/lib/hia/telemetry");
const { localInferenceQueue } = require("../../../tools/lib/hia/guard");
const { redact } = require("../../../tools/lib/redact");
const { resolveComboModel, rememberCombo } = require("../../../tools/lib/hia/combo-routing");
const E = require("../../../tools/lib/engines");
const { recordFallback, recordComboOutcome } = require("./routing-outcomes.service");
const crypto = require("crypto");

// "ollama:qwen2.5-coder:1.5b" -> "qwen2.5-coder:1.5b"
const localModelOf = (targetId) => (typeof targetId === "string" && targetId.startsWith("ollama:") ? targetId.slice(7) : "");

/**
 * Tenta resolver uma requisição de chat via Script-First ou Local-First
 * @param {{
 *   engine: string,
 *   model?: string,
 *   prompt: string,
 *   slug: string,
 *   sessionId?: string,
 *   history?: any[],
 *   signal?: AbortSignal,
 *   sink: { onChunk: (data: any) => void, onDone: (data: any) => void, onError: (err: any) => void },
 *   fallbackStream: (override?: { model?: string, onChunk?: (data: any) => void, onDone?: (data: any) => void }) => void
 * }} params
 * @returns {Promise<boolean>} Retorna true se a requisição foi interceptada e tratada localmente
 */
async function handleChatWithHia({ engine, model, prompt, slug, sessionId, history, signal, sink, fallbackStream }) {
  const isEnabled = process.env.HIA_ROUTING_ENABLED !== "false";
  if (!isEnabled) {
    fallbackStream();
    return false;
  }

  const decision = routeTask({
    prompt,
    requestedEngine: engine,
    hasHistory: Array.isArray(history) && history.length > 0,
  });

  // ROTA 1: Script-First (Ferramenta Determinística)
  if (decision.destination === "script") {
    const start = Date.now();
    const sid = sessionId || `hia-script-${crypto.randomUUID().slice(0, 8)}`;

    sink.onChunk({
      type: "thinking",
      text: `[HIA Script-First] ${decision.reason}\nExecutando '${decision.targetId}' determinístico...\n\n`,
      sessionId: sid,
    });

    const res = await executeTool(decision.targetId, { project: slug });
    const durationMs = Date.now() - start;

    if (res.ok) {
      const outputText = `### Resultado da Automação Local (${decision.targetId})\n\n\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\`\n\n*Executado em ${durationMs}ms com 0 consumo de tokens em nuvem.*`;

      sink.onChunk({ type: "text", text: outputText, sessionId: sid });
      sink.onDone({
        sessionId: sid,
        fullText: outputText,
        hiaRoute: "script",
        hiaTool: decision.targetId,
        tokensSaved: decision.estimatedTokensSaved || 0,
      });

      recordExecution({
        executionId: `exec-${Date.now()}`,
        executorType: "script",
        executorId: decision.targetId,
        status: "succeeded",
        durationMs,
        tokensPrompt: 0,
        tokensCompletion: 0,
        tokensTotal: 0,
        tokensSaved: decision.estimatedTokensSaved,
      });

      return true;
    } else {
      sink.onChunk({
        type: "thinking",
        text: `[HIA Aviso] Falha na execução da ferramenta local '${decision.targetId}'. Prosseguindo com o motor em nuvem...\n\n`,
        sessionId: sid,
      });
      recordFallback({ from: "script", target: decision.targetId, reason: "tool_failed", slug });
      fallbackStream();
      return false;
    }
  }

  // ROTA 2: Local-First (inferência no Ollama local, sem consumo de cota)
  if (decision.destination === "local_llm") {
    const impl = E.engines.get("ollama");
    if (!impl) {
      recordFallback({ from: "local_llm", target: "ollama", reason: "engine_missing", slug });
      fallbackStream();
      return false;
    }

    const sid = sessionId || `hia-local-${crypto.randomUUID().slice(0, 8)}`;
    const model = localModelOf(decision.targetId);
    const start = Date.now();
    let failed = false;
    let emittedText = false;

    sink.onChunk({
      type: "thinking",
      text: `[HIA Local-First] ${decision.reason}\nModelo local: ${model || "padrão"}.\n\n`,
      sessionId: sid,
    });

    // Uma inferência local por vez (mesma fila usada pelo resto da camada HIA).
    await localInferenceQueue.run(() => new Promise((resolve) => {
      impl.stream({
        prompt,
        slug,
        sessionId: sid,
        history,
        model,
        effort: "medium",
        signal,
        onChunk: (data) => {
          if (data && data.type === "text" && data.text) emittedText = true;
          sink.onChunk({ ...data, sessionId: sid, hiaRoute: "local_llm" });
        },
        onDone: (data) => {
          const durationMs = Date.now() - start;
          sink.onDone({
            ...(data || {}),
            sessionId: sid,
            hiaRoute: "local_llm",
            hiaModel: model,
            tokensSaved: decision.estimatedTokensSaved || 0,
          });
          recordExecution({
            executionId: `exec-${Date.now()}`,
            executorType: "local_llm",
            executorId: model || "ollama",
            status: "succeeded",
            durationMs,
            tokensPrompt: 0,
            tokensCompletion: 0,
            tokensTotal: 0,
            tokensSaved: decision.estimatedTokensSaved,
          });
          resolve();
        },
        onError: (err) => {
          failed = true;
          if (!emittedText) {
            sink.onChunk({
              type: "thinking",
              text: `[HIA Aviso] Ollama local indisponível (${err?.message || err}). Prosseguindo com o motor em nuvem...\n\n`,
              sessionId: sid,
            });
          } else {
            sink.onError(err);
          }
          resolve();
        },
      });
    }));

    if (failed && !emittedText) {
      recordFallback({ from: "local_llm", target: model || "ollama", reason: "unavailable", slug });
      fallbackStream();
      return false;
    }
    return !failed;
  }

  // ROTA 3: Cloud-on-Demand (motor solicitado pelo usuário)
  // Com HIA_COMBO_ROUTING=true e o modelo "9router/Harness" escolhido, o turno roda no combo sugerido;
  // a conversa mantém o combo nos turnos seguintes (memória por sessão do opencode).
  const comboModel = resolveComboModel({ engine, model, sessionId, suggestion: decision.suggestedCombo });
  // Registra o combo sugerido (e aplicado, se houve) para medir a sugestão contra o uso real.
  if (decision.suggestedCombo) {
    try {
      recordExecution({
        executionId: `exec-${Date.now()}`,
        executorType: "cloud",
        executorId: engine,
        status: "routed",
        durationMs: 0,
        tokensPrompt: 0,
        tokensCompletion: 0,
        tokensTotal: 0,
        tokensSaved: 0,
        suggestedCombo: decision.suggestedCombo.combo,
        suggestedType: decision.suggestedCombo.type,
        ...(comboModel ? { appliedCombo: comboModel } : {}),
        project: slug,
        // Short redacted excerpt so the suggestion can be audited by hand; never the full prompt.
        promptPreview: redact(String(prompt || "").slice(0, 400)).replace(/\s+/g, " ").slice(0, 120),
      });
    } catch {}
  }
  if (comboModel) {
    sink.onChunk({ type: "thinking", text: `[HIA] Roteado para o combo ${comboModel.replace(/^9router\//, "")} (${decision.suggestedCombo?.type || "conversa em andamento"}).\n`, sessionId });
    // Remember the combo as soon as the engine reports the session id, so a dropped client or an aborted first turn
    // still keeps the conversation on its combo; the done event covers engines that report the id only at the end.
    const remember = (data) => rememberCombo(data?.sessionId || sessionId || "", comboModel);
    const startedAt = Date.now();
    let recorded = false;
    // One outcome per turn; a turn the user cancelled is neither a success nor a combo failure.
    const outcome = (ok, error) => {
      if (recorded || (!ok && signal?.aborted)) return;
      recorded = true;
      recordComboOutcome({ combo: comboModel, ok, durationMs: Date.now() - startedAt, slug, error });
    };
    fallbackStream({
      model: comboModel,
      onChunk: (data) => { if (data?.sessionId) remember(data); },
      onDone: (data) => { remember(data); outcome(true); },
      onError: (err) => outcome(false, err),
    });
    return false;
  }
  fallbackStream();
  return false;
}

module.exports = {
  handleChatWithHia,
};

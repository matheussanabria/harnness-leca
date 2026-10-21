// @ts-check
// Shadow Interceptor — Local AI Runtime (EP-03.01)
// Monitoramento passivo e assíncrono das requisições sem afetar a resposta do usuário.
// Zero fallback para nuvem.

const { classifyTask } = require("./classifier");
const { recordInference } = require("./telemetry");

/**
 * Intercepta uma requisição em modo shadow, executando a classificação em background.
 * Não bloqueia o chamador nem lança exceções para o fluxo principal.
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} params.slug
 * @param {string} params.actualEngine
 * @param {string} [params.correlationId]
 * @param {string} [params.model="qwen3.5:4b"]
 */
function interceptShadowRequest({
  prompt,
  slug,
  actualEngine,
  correlationId = "shadow-" + Math.random().toString(36).slice(2, 10),
  model = "qwen3.5:4b",
}) {
  // Fire-and-forget seguro com setImmediate
  setImmediate(async () => {
    try {
      // Timeout estrito de 8 segundos para evitar acúmulo de requisições de shadow
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);

      const result = await classifyTask({
        text: prompt,
        model,
        signal: ac.signal,
      }).catch((err) => ({
        success: false,
        errors: [err instanceof Error ? err.message : String(err)],
        // Mesmos campos opcionais do resultado declarado: sem isso a uniao de tipos
        // esconderia `classification` e `metrics` de quem consome o resultado.
        classification: undefined,
        metrics: undefined,
        isAutomatedExecution: /** @type {false} */ (false),
      }));

      clearTimeout(timer);

      // Gravação na telemetria
      if (result.success && result.classification) {
        recordInference({
          correlationId,
          slug,
          model,
          valid: true,
          tipo: result.classification.tipo,
          complexidade: result.classification.complexidade,
          executorSugerido: result.classification.executorSugerido,
          modulo: result.classification.modulo,
          totalDurationMs: result.metrics?.totalDurationMs,
          loadDurationMs: result.metrics?.loadDurationMs,
          promptDurationMs: result.metrics?.promptDurationMs,
          evalDurationMs: result.metrics?.evalDurationMs,
          tokensPrompt: result.metrics?.tokensPrompt,
          tokensGenerated: result.metrics?.tokensGenerated,
        });
      } else {
        recordInference({
          correlationId,
          slug,
          model,
          valid: false,
          errors: result.errors || ["Falha desconhecida no classificador"],
          totalDurationMs: result.metrics?.totalDurationMs,
          tokensPrompt: result.metrics?.tokensPrompt,
        });
      }
    } catch {
      // Silencioso por design de acordo com a ADR-002: falhas de shadow não afetam nada
    }
  });
}

module.exports = {
  interceptShadowRequest,
};

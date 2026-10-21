// @ts-check
// Task Classifier — Local AI Runtime (EP-02.02)
// Serviço de classificação estruturada com validação estrita e prompt determinístico.

const { generateStructured } = require("./ollama-client");
const { validateClassification } = require("./schema");

const CLASSIFICATION_SYSTEM_PROMPT = `Você é um classificador determinístico de tarefas de engenharia de software para o Harness Leca.
Sua única função é classificar o pedido em um formato JSON rigorosamente fechado.

Valores permitidos:
- tipo: "bug" | "feature" | "refactor" | "docs" | "test"
- complexidade: "baixa" | "media" | "alta"
- modulo: nome do módulo ou subsistema afetado (ex: "diario", "chat", "overview", "runtime", "infra", "geral")
- executorSugerido: "local_llm" | "cloud_llm" | "script" | "human"
- justificativa: explicação sucinta e direta do motivo da classificação.

Exemplo de saída estrita:
{
  "tipo": "bug",
  "complexidade": "baixa",
  "modulo": "diario",
  "executorSugerido": "local_llm",
  "justificativa": "Correção de comportamento existente sem alteração de contrato"
}`;

/**
 * Classifica uma solicitação de usuário ou tarefa técnica
 * @param {Object} params
 * @param {string} params.text
 * @param {string} [params.model="qwen3.5:4b"]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{
 *   success: boolean,
 *   classification?: import("./schema").TaskClassification,
 *   raw?: string,
 *   metrics?: Object,
 *   errors?: string[],
 *   isAutomatedExecution: false
 * }>}
 */
async function classifyTask({ text, model = "qwen3.5:4b", signal }) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return {
      success: false,
      errors: ["Texto de entrada vazio ou inválido para classificação."],
      isAutomatedExecution: false,
    };
  }

  const prompt = `Classifique a seguinte solicitação de desenvolvimento:\n\n"""\n${text.trim()}\n"""\n\nResponda APENAS com o objeto JSON válido:`;

  try {
    const res = await generateStructured({
      prompt,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      model,
      temperature: 0.1,
      numPredict: 200,
      think: false,
      signal,
    });

    const validation = validateClassification(res.data);
    if (!validation.valid) {
      return {
        success: false,
        raw: res.raw,
        metrics: res.metrics,
        errors: validation.errors,
        isAutomatedExecution: false,
      };
    }

    return {
      success: true,
      classification: validation.value,
      raw: res.raw,
      metrics: res.metrics,
      isAutomatedExecution: false,
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
      isAutomatedExecution: false,
    };
  }
}

module.exports = {
  CLASSIFICATION_SYSTEM_PROMPT,
  classifyTask,
};

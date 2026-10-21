// @ts-check
// Schema e Validador Estrito do Task Classifier — Local AI Runtime (EP-02.01)

const VALID_TIPOS = new Set(["bug", "feature", "refactor", "docs", "test"]);
const VALID_COMPLEXIDADES = new Set(["baixa", "media", "alta"]);
const VALID_EXECUTORES = new Set(["local_llm", "cloud_llm", "script", "human"]);

/**
 * @typedef {Object} TaskClassification
 * @property {"bug"|"feature"|"refactor"|"docs"|"test"} tipo
 * @property {"baixa"|"media"|"alta"} complexidade
 * @property {string} modulo
 * @property {"local_llm"|"cloud_llm"|"script"|"human"} executorSugerido
 * @property {string} justificativa
 */

/**
 * Valida estritamente se um objeto adere ao contrato de classificação de tarefas
 * @param {any} data
 * @returns {{ valid: boolean, errors: string[], value?: TaskClassification }}
 */
function validateClassification(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Payload deve ser um objeto JSON válido."] };
  }

  // 1. Validação de Tipo
  const tipo = typeof data.tipo === "string" ? data.tipo.toLowerCase().trim() : "";
  if (!VALID_TIPOS.has(tipo)) {
    errors.push(`'tipo' inválido ou ausente. Valores aceitos: ${Array.from(VALID_TIPOS).join(", ")}. Recebido: '${data.tipo}'`);
  }

  // 2. Validação de Complexidade
  const complexidade = typeof data.complexidade === "string" ? data.complexidade.toLowerCase().trim() : "";
  if (!VALID_COMPLEXIDADES.has(complexidade)) {
    errors.push(`'complexidade' inválida ou ausente. Valores aceitos: ${Array.from(VALID_COMPLEXIDADES).join(", ")}. Recebido: '${data.complexidade}'`);
  }

  // 3. Validação de Módulo
  const modulo = typeof data.modulo === "string" ? data.modulo.toLowerCase().trim() : "";
  if (!modulo) {
    errors.push("'modulo' deve ser uma string não vazia.");
  }

  // 4. Validação de Executor Sugerido
  const executor = typeof data.executorSugerido === "string" ? data.executorSugerido.toLowerCase().trim() : "";
  if (!VALID_EXECUTORES.has(executor)) {
    errors.push(`'executorSugerido' inválido ou ausente. Valores aceitos: ${Array.from(VALID_EXECUTORES).join(", ")}. Recebido: '${data.executorSugerido}'`);
  }

  // 5. Validação de Justificativa
  const justificativa = typeof data.justificativa === "string" ? data.justificativa.trim() : "";
  if (!justificativa) {
    errors.push("'justificativa' deve ser uma string informativa não vazia.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    // @ts-ignore
    value: {
      tipo,
      complexidade,
      modulo,
      executorSugerido: executor,
      justificativa,
    },
  };
}

module.exports = {
  VALID_TIPOS,
  VALID_COMPLEXIDADES,
  VALID_EXECUTORES,
  validateClassification,
};

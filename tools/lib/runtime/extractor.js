// @ts-check
// Extractor Service — Local AI Runtime (EP-06.02)
// Extração estruturada de decisões, regras, termos e resumo utilizando Ollama local.

const { generateStructured } = require("./ollama-client");

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator determinístico de conhecimento para o Harness Leca.
Analise a transcrição de conversa ou especificação técnica e extraia:
1. "decisoes": lista de decisões técnicas/arquiteturais tomadas.
2. "regras": lista de diretrizes, proibições, regras de negócio ou limites estabelecidos.
3. "termos": termos do domínio, siglas ou conceitos específicos.
4. "resumo": resumo conciso em até 2 frases.

Responda APENAS com um objeto JSON válido no formato:
{
  "decisoes": ["..."],
  "regras": ["..."],
  "termos": ["..."],
  "resumo": "..."
}`;

/**
 * @typedef {Object} ExtractionResult
 * @property {string[]} decisoes
 * @property {string[]} regras
 * @property {string[]} termos
 * @property {string} resumo
 */

/**
 * Valida se um objeto satisfaz o contrato de extração estruturada
 * @param {any} data
 * @returns {{ valid: boolean, errors: string[], value?: ExtractionResult }}
 */
function validateExtraction(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Payload de extração deve ser um objeto JSON."] };
  }

  const parseStringArray = (arr, fieldName) => {
    if (!Array.isArray(arr)) {
      errors.push(`'${fieldName}' deve ser um array.`);
      return [];
    }
    return arr.map((item) => String(item).trim()).filter(Boolean);
  };

  const decisoes = parseStringArray(data.decisoes, "decisoes");
  const regras = parseStringArray(data.regras, "regras");
  const termos = parseStringArray(data.termos, "termos");
  const resumo = typeof data.resumo === "string" ? data.resumo.trim() : "";

  if (!resumo) {
    errors.push("'resumo' deve ser uma string não vazia.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    value: { decisoes, regras, termos, resumo },
  };
}

/**
 * Executa a extração estruturada de conhecimento a partir de um texto
 * @param {Object} params
 * @param {string} params.text
 * @param {string} [params.model="qwen3.5:4b"]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{
 *   success: boolean,
 *   extraction?: ExtractionResult,
 *   metrics?: Object,
 *   errors?: string[]
 * }>}
 */
async function extractKnowledge({ text, model = "qwen3.5:4b", signal }) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return { success: false, errors: ["Texto vazio para extração."] };
  }

  const prompt = `Analise o texto a seguir e extraia o conhecimento estruturado:\n\n"""\n${text.trim()}\n"""\n\nResponda APENAS em JSON:`;

  try {
    const res = await generateStructured({
      prompt,
      system: EXTRACTION_SYSTEM_PROMPT,
      model,
      temperature: 0.1,
      numPredict: 512,
      numCtx: 4096,
      think: false,
      signal,
    });

    const validation = validateExtraction(res.data);
    if (!validation.valid) {
      return {
        success: false,
        metrics: res.metrics,
        errors: validation.errors,
      };
    }

    return {
      success: true,
      extraction: validation.value,
      metrics: res.metrics,
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  validateExtraction,
  extractKnowledge,
};

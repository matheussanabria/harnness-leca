// @ts-check
// Model Registry: Catálogo formal de modelos locais e remotos para decisão do roteador HIA
// Aderente ao schema schemas/hia-model.schema.json

/**
 * @typedef {Object} ModelCapability
 * @property {string} id
 * @property {"local_llm"|"cloud_reasoning"|"cloud_code"|"cloud_fast"} tier
 * @property {string} provider
 * @property {number} contextWindow
 * @property {string[]} strengths
 * @property {boolean} requiresGpu
 * @property {number} estimatedRamMb
 * @property {boolean} freeTier
 */

/** @type {ModelCapability[]} */
const MODELS = [
  {
    id: "qwen2.5-coder:1.5b",
    tier: "local_llm",
    provider: "ollama",
    contextWindow: 4096,
    strengths: ["json_extraction", "classification", "code_snippet"],
    requiresGpu: false,
    estimatedRamMb: 1400,
    freeTier: true,
  },
  {
    id: "qwen2.5-coder:3b",
    tier: "local_llm",
    provider: "ollama",
    contextWindow: 4096,
    strengths: ["unit_test_generation", "code_explanation", "diff_review"],
    requiresGpu: false,
    estimatedRamMb: 2500,
    freeTier: true,
  },
  {
    id: "gemini-3.8-flash",
    tier: "cloud_fast",
    provider: "gemini",
    contextWindow: 1048576,
    strengths: ["fast_reasoning", "multimodal", "large_context"],
    requiresGpu: false,
    estimatedRamMb: 0,
    freeTier: true,
  },
  {
    id: "qwen3.6-plus-free",
    tier: "cloud_code",
    provider: "opencode",
    contextWindow: 131072,
    strengths: ["code_generation", "deep_refactoring"],
    requiresGpu: false,
    estimatedRamMb: 0,
    freeTier: true,
  },
  {
    id: "sonnet",
    tier: "cloud_reasoning",
    provider: "claude",
    contextWindow: 200000,
    strengths: ["high_complexity_architecture", "multi_step_agentic_flow"],
    requiresGpu: false,
    estimatedRamMb: 0,
    freeTier: false,
  },
];

/**
 * Retorna todos os modelos cadastrados no Model Registry
 * @returns {ModelCapability[]}
 */
function listModels() {
  return [...MODELS];
}

/**
 * Busca modelo por ID
 * @param {string} id
 * @returns {ModelCapability | undefined}
 */
function getModel(id) {
  return MODELS.find((m) => m.id === id);
}

/**
 * Retorna modelos adequados para uma determinada força/capacidade técnica
 * @param {string} capability
 * @param {boolean} [localOnly=false]
 */
function findModelsByCapability(capability, localOnly = false) {
  return MODELS.filter((m) => {
    if (localOnly && m.tier !== "local_llm") return false;
    return m.strengths.includes(capability);
  });
}

module.exports = {
  listModels,
  getModel,
  findModelsByCapability,
};

// @ts-check
// Intelligent Task Router: Roteador em camadas (Script-First -> Local-First -> Cloud-on-Demand)
// Cumpre ADR-HIA-001, ADR-HIA-002 e ADR-HIA-003. Totalmente desativável via HIA_ROUTING_ENABLED=false.

const { getTool } = require("./registry");
const { getHardwareSnapshot } = require("./hardware-profiler");
const { getModel } = require("./model-registry");

/**
 * @typedef {Object} RoutingDecision
 * @property {"script"|"local_llm"|"cloud"} destination
 * @property {string} targetId
 * @property {string} reason
 * @property {boolean} deterministic
 * @property {number} estimatedTokensSaved
 */

const MAX_DETERMINISTIC_PROMPT = 240;
const ATTACHMENT_RE = /\.(jpe?g|png|webp|gif|pdf)\b/;
const BUILD_INTENT_RE = /implement|\bcri(e|ar|ando)\b|desenvolv|construa|nova tela|nova p[aá]gina|prot[oó]tipo|refator|altere|ajuste|corrija|adicione/;

/**
 * Analisa a intenção da instrução para identificar se existe script determinístico direto
 * @param {string} prompt
 * @returns {string | null}
 */
function matchDeterministicTool(prompt) {
  const p = (prompt || "").toLowerCase();

  // Pedidos longos, com anexo ou de implementação nunca são comandos determinísticos:
  // palavras soltas como "check" ou "json" no meio de um briefing não bastam.
  if (p.length > MAX_DETERMINISTIC_PROMPT || ATTACHMENT_RE.test(p) || BUILD_INTENT_RE.test(p)) return null;

  // 1. git.status
  if (
    /git status/i.test(p) ||
    (/status/i.test(p) && /git|reposit[oó]rio|branch/i.test(p)) ||
    (/arquivos modifi/i.test(p) && !/refatore|altere|crie/i.test(p))
  ) {
    return "git.status";
  }

  // 2. repo.check
  if (
    /check\.js|npm run check/i.test(p) ||
    (/check|checagem/i.test(p) && /sintaxe|json/i.test(p)) ||
    (/verifiq(ue)?/i.test(p) && /sintaxe/i.test(p))
  ) {
    return "repo.check";
  }

  // 3. coordination.status
  if (
    /coordination\.js|status de coordena/i.test(p) ||
    (/quem est[aá] trabalhando/i.test(p) && /hist[oó]ria|task/i.test(p)) ||
    (/claim/i.test(p) && /hist[oó]ria|task/i.test(p)) ||
    (/posse do agente|claim ativo/i.test(p))
  ) {
    return "coordination.status";
  }

  // 4. context.list
  if (
    (/listar?|quais/i.test(p) && /contextos?|arquivos de contexto/i.test(p)) ||
    (/documentos de contexto/i.test(p))
  ) {
    return "context.list";
  }

  return null;
}

/**
 * Decide a rota ideal para a requisição com base no princípio Script-First -> Local-First -> Cloud
 * @param {{
 *   prompt: string,
 *   requestedEngine?: string,
 *   requestedModel?: string,
 *   hasHistory?: boolean
 * }} input
 * @returns {RoutingDecision}
 */
function routeTask(input) {
  const isEnabled = process.env.HIA_ROUTING_ENABLED !== "false";
  const prompt = input.prompt || "";

  // Se o roteamento estiver explicitamente desativado pelo usuário, respeita a nuvem/motor original
  if (!isEnabled) {
    return {
      destination: "cloud",
      targetId: input.requestedEngine || "claude",
      reason: "HIA_ROUTING_ENABLED desativado; respeitando motor solicitado diretamente.",
      deterministic: false,
      estimatedTokensSaved: 0,
    };
  }

  // Se a conversa já possui histórico encadeado em andamento, preserva o motor solicitado para manter consistência
  if (input.hasHistory && input.requestedEngine) {
    return {
      destination: "cloud",
      targetId: input.requestedEngine,
      reason: "Conversa em andamento com histórico; mantendo consistência do motor de chat.",
      deterministic: false,
      estimatedTokensSaved: 0,
    };
  }

  // CAMADA 1: Script-First (Automações determinísticas com custo 0 de tokens)
  const matchedToolId = matchDeterministicTool(prompt);
  if (matchedToolId && getTool(matchedToolId)) {
    return {
      destination: "script",
      targetId: matchedToolId,
      reason: `Tarefa determinística identificada: resolvida localmente por ferramenta nativa '${matchedToolId}'.`,
      deterministic: true,
      estimatedTokensSaved: 1200,
    };
  }

  // CAMADA 2: Local-First (Inferência leve em CPU com Ollama)
  const isCandidateForLocal =
    /extraia o json|formate em json|classifique|resuma em poucas palavras|gere um teste simples/i.test(prompt) &&
    prompt.length < 1500;

  if (isCandidateForLocal) {
    const hw = getHardwareSnapshot();
    if (hw.viable) {
      return {
        destination: "local_llm",
        targetId: "ollama:qwen2.5-coder:1.5b",
        reason: "Tarefa leve com formato estrito; direcionada para Ollama local preservando cota de IA.",
        deterministic: false,
        estimatedTokensSaved: 800,
      };
    }
  }

  // CAMADA 3: Cloud-on-Demand (Raciocínio complexo em motores em nuvem)
  const targetEngine = input.requestedEngine || "claude";
  return {
    destination: "cloud",
    targetId: targetEngine,
    reason: "Tarefa com complexidade de raciocínio, dependência de código longo ou histórico interativo.",
    deterministic: false,
    estimatedTokensSaved: 0,
  };
}

module.exports = {
  routeTask,
  matchDeterministicTool,
};

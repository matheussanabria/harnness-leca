// @ts-check
// Resolvedor de capacidade por sessão (EP-09.04).
// Decide a capacidade operacional (retomada nativa, replay de contexto, sem suporte)
// cruzando o provedor, identificador nativo, origem e capacidades do motor.
// Módulo puro: sem I/O de rede ou disco.

// Espelho estático e puro de execution.resume/execution.cancel do catálogo do servidor
// (ui/server/services/orchestration/capability-catalog.js). O navegador não pode importar
// código CommonJS do servidor: a rota /server/... não é servida e quebrava todo o grafo de módulos do escritório.
const CAPS = {
  claude: { resume: ["available", "native", "Retoma pelo UUID nativo do Claude Code."], cancel: ["degraded", "owned_process", "Só cancela execução iniciada pelo Harness."] },
  codex: { resume: ["available", "native", "Retoma pelo UUID nativo do Codex CLI."], cancel: ["degraded", "owned_process", "Cancela o subprocesso iniciado pelo Harness."] },
  opencode: { resume: ["degraded", "native", "Retoma por ses_* em melhor esforço."], cancel: ["degraded", "owned_process", "Cancela execução iniciada pelo Harness via /abort."] },
  gemini: { resume: ["unavailable", "unsupported", "A API não guarda sessão nativa; continuidade usa replay de contexto."], cancel: ["degraded", "owned_process", "Cancela o AbortSignal do pedido atual."] },
  ollama: { resume: ["unavailable", "unsupported", "Não há sessão nativa no daemon."], cancel: ["degraded", "owned_process", "Cancela o AbortSignal do pedido atual."] },
};

/** @param {string} providerId @param {string} operationId */
function resolveProviderCapability(providerId, operationId) {
  const row = /** @type {any} */ (CAPS)[providerId]?.[operationId === "execution.resume" ? "resume" : operationId === "execution.cancel" ? "cancel" : ""];
  if (!row) return null;
  const [state, mode, reason] = row;
  return { provider: providerId, operation: operationId, state, mode, scope: "", reason, available: state === "available", usable: state === "available" || state === "degraded" };
}

/**
 * @typedef {"native" | "context_replay" | "unsupported"} ResumeMode
 * @typedef {"available" | "degraded" | "unavailable" | "unknown"} CapabilityState
 */

/**
 * Normaliza o ID de provedor para a chave canônica.
 * @param {string} provider
 * @returns {string}
 */
export function normalizeProvider(provider) {
  const p = String(provider || "").trim().toLowerCase();
  if (p === "claude-code" || p === "claude") return "claude";
  if (p === "antigravity" || p === "gemini") return "gemini";
  if (p === "opencode") return "opencode";
  if (p === "codex") return "codex";
  if (p === "ollama") return "ollama";
  return p;
}

/**
 * Avalia a capacidade de retomada de uma sessão.
 * @param {object} session
 * @param {object} [options]
 * @param {Function} [options.capabilityResolver] Injeção de dependência para testes
 * @returns {{
 *   provider: string,
 *   resumeMode: ResumeMode,
 *   state: CapabilityState,
 *   canResume: boolean,
 *   canReplay: boolean,
 *   hasNativeId: boolean,
 *   hasArtifact: boolean,
 *   canCancel: boolean,
 *   reason: string
 * }}
 */
export function resolveSessionCapabilities(session, options = {}) {
  const provider = normalizeProvider(session?.primaryProvider || session?.provider || "");
  const resolver = options.capabilityResolver || resolveProviderCapability;

  const nativeId = String(session?.nativeSessionId || session?.sessionId || "").trim();
  const hasNativeId = Boolean(nativeId);

  // Artefatos vinculados (Markdown legível)
  const artifacts = Array.isArray(session?.artifacts) ? session.artifacts : [];
  const relPath = String(session?.relPath || session?.sourceFile || "");
  const hasArtifact = artifacts.length > 0 || Boolean(relPath && /\.md$/i.test(relPath));

  // Consulta catálogo da 08.01 para "execution.resume"
  const resumeCap = resolver ? resolver(provider, "execution.resume") : null;
  // Consulta catálogo da 08.01 para "execution.cancel"
  const cancelCap = resolver ? resolver(provider, "execution.cancel") : null;

  // Avaliação de cancelamento: só se for harness_owned e disponível/degradado
  const isHarnessOwned = Boolean(session?.harnessOwned || session?.owner === "harness" || session?.isHarness);
  const canCancel = Boolean(isHarnessOwned && cancelCap && (cancelCap.available || cancelCap.usable));

  // Se o provedor suporta retomada nativa e temos o nativeSessionId
  if (resumeCap && (resumeCap.mode === "native" || resumeCap.available) && hasNativeId) {
    return {
      provider,
      resumeMode: "native",
      state: resumeCap.state || "available",
      canResume: true,
      canReplay: false,
      hasNativeId: true,
      hasArtifact,
      canCancel,
      reason: resumeCap.reason || "Retomada nativa suportada pelo provedor.",
    };
  }

  // Se tem artefato Markdown ou histórico gravado, permite replay de contexto
  if (hasArtifact) {
    return {
      provider,
      resumeMode: "context_replay",
      state: "degraded",
      canResume: false,
      canReplay: true,
      hasNativeId,
      hasArtifact: true,
      canCancel,
      reason: "Motor não retoma sessão nativa; continuidade via contexto histórico.",
    };
  }

  // Sem retomada nativa nem artefato de contexto
  return {
    provider,
    resumeMode: "unsupported",
    state: "unavailable",
    canResume: false,
    canReplay: false,
    hasNativeId,
    hasArtifact: false,
    canCancel,
    reason: "Sem identificador nativo ou artefato histórico para continuidade.",
  };
}

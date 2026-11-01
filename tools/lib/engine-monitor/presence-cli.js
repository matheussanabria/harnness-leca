// @ts-check
// Detecção de presença para motores de linha de comando (Claude, Gemini, Codex) (EP-09.06).
// Valida se há sessões ativas dentro da janela inactiveAfterMs.

/**
 * Avalia presença de um motor CLI a partir do timestamp da última sessão observada.
 * @param {string} engineId "claude" | "gemini" | "codex"
 * @param {number | null | undefined} lastSessionTimeMs
 * @param {{ nowMs?: number, inactiveAfterMs: number }} opts
 * @returns {{ presenca: "online" | "offline", detalhe?: string }}
 */
function checkCliPresence(engineId, lastSessionTimeMs, opts) {
  const nowMs = opts.nowMs || Date.now();
  if (!lastSessionTimeMs || typeof lastSessionTimeMs !== "number") {
    return {
      presenca: "offline",
      detalhe: "nenhuma sessão recente registrada",
    };
  }

  const diff = nowMs - lastSessionTimeMs;
  if (diff <= opts.inactiveAfterMs) {
    return {
      presenca: "online",
      detalhe: `sessão ativa recente (${Math.round(diff / 1000)}s atrás)`,
    };
  }

  return {
    presenca: "offline",
    detalhe: `sem atividade há mais de ${Math.round(diff / 60000)}m`,
  };
}

module.exports = {
  checkCliPresence,
};

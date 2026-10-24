// @ts-check
// Formatação pura do resumo de atividade de um motor (dossiê da estação). Sem DOM.
// Regra: nunca inventar atividade. Contagem 0 mostra espera; "sessões abertas" é separado de "em andamento".

/** @param {unknown} value @returns {number} inteiro >= 0 (qualquer coisa inválida vira 0) */
const toCount = (value) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * @param {{ activeCount?: unknown, openCount?: unknown, currentTask?: unknown } | null | undefined} info
 * @returns {{ working: boolean, activeCount: number, openCount: number, headline: string, openLine: string, task: string }}
 */
export function formatEngineActivity(info) {
  const activeCount = toCount(info?.activeCount);
  const openCount = toCount(info?.openCount);
  const working = activeCount > 0;
  return {
    working,
    activeCount,
    openCount,
    headline: working ? `${activeCount} em andamento` : "Em espera (standby)",
    openLine: openCount > 0 ? `${openCount} ${openCount === 1 ? "sessão aberta" : "sessões abertas"}` : "",
    // Tarefa só existe enquanto algo roda: texto residual de um motor ocioso é descartado.
    task: working ? String(info?.currentTask || "") : ""
  };
}

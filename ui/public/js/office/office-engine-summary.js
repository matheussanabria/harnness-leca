// @ts-check
// Resumo único por motor para os cards da Central e o telão da sala de guerra (T2.4).
//
// Fontes: estado canônico do Escritório (projeção EP-09 quando o stream está conectado) e a lista de
// execuções do stream de orquestração, que é o que a Central também exibe em "Execuções comprovadas".
// A contagem é o MAIOR dos dois (não a soma): ambos podem descrever a mesma execução, e o card nunca
// pode contradizer a lista exibida logo abaixo.

/**
 * @param {any[] | undefined} executions
 * @param {string} engine
 * @returns {number}
 */
export function countRunningExecutions(executions, engine) {
  return (executions || []).filter((e) => e && e.provider === engine && e.status === "running").length;
}

/**
 * @param {string} engine
 * @param {{ agentState?: { activeCount?: number, openCount?: number } | null, executions?: any[], integration?: { status?: string } | null }} input
 * @returns {{ engine: string, activeCount: number, openCount: number, state: "working" | "open" | "integration", integrationStatus: string }}
 */
export function summarizeEngine(engine, { agentState, executions, integration }) {
  const fromState = Math.max(0, Math.floor(Number(agentState?.activeCount) || 0));
  const activeCount = Math.max(fromState, countRunningExecutions(executions, engine));
  const openCount = Math.max(0, Math.floor(Number(agentState?.openCount) || 0));
  const state = activeCount > 0 ? "working" : openCount > 0 ? "open" : "integration";
  return { engine, activeCount, openCount, state, integrationStatus: String(integration?.status || "") };
}

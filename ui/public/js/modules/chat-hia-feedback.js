// @ts-check
// Feedback visual e contabilização das interceptações HIA no chat (PI-1, PI-3 e PI-5).

const SAVED_TOKENS_KEY = "hia_tokens_saved";

/**
 * Texto de status exibido enquanto o HIA executa algo localmente.
 * @param {string} text
 * @returns {string|null}
 */
export function hiaStatusFromThinking(text) {
  return text && text.startsWith("[HIA") ? "HIA: automatizando localmente, sem consumo de cota..." : null;
}

/**
 * Copia os metadados da rota HIA para o turno do assistente.
 * @param {any} turn
 * @param {any} data
 * @returns {number} tokens economizados neste turno
 */
export function applyHiaDone(turn, data) {
  if (!turn || !data || !data.hiaRoute) return 0;
  turn.hiaRoute = data.hiaRoute;
  turn.hiaTool = data.hiaTool || "";
  turn.tokensSaved = Number(data.tokensSaved) || 0;
  // A rota local assina o turno com o próprio motor local (o rótulo sai como "Ollama Local").
  if (data.hiaRoute === "local_llm") {
    turn.engine = "ollama";
    if (data.hiaModel) turn.model = data.hiaModel;
  }
  return turn.tokensSaved;
}

/**
 * Soma os tokens economizados na sessão corrente do browser.
 * @param {number} tokensSaved
 * @returns {number} total acumulado na sessão
 */
export function accumulateHiaSavings(tokensSaved) {
  try {
    const total = Number(sessionStorage.getItem(SAVED_TOKENS_KEY) || 0) + (Number(tokensSaved) || 0);
    sessionStorage.setItem(SAVED_TOKENS_KEY, String(total));
    return total;
  } catch {
    return Number(tokensSaved) || 0;
  }
}

/**
 * Aplica os metadados da rota e, quando Script-First, atualiza o status com o total da sessão.
 * @param {any} turn
 * @param {any} data
 * @param {(text: string) => void} setStatus
 */
export function applyHiaFeedback(turn, data, setStatus) {
  const tokensSaved = applyHiaDone(turn, data);
  if (turn.hiaRoute === "script") {
    setStatus(`HIA economizou ~${accumulateHiaSavings(tokensSaved).toLocaleString("pt-BR")} tokens nesta sessão`);
  } else if (turn.hiaRoute === "local_llm") {
    setStatus(`HIA respondeu no motor local (${turn.model || "Ollama"}), sem consumir cota de nuvem`);
  }
}

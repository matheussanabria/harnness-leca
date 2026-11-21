// @ts-check
// Interrupted chat answers (EP-23.04). A run that ended without an answer (server restart, stop, nobody watching)
// keeps its partial text with an "Interrompida" label and two actions: "Retomar" continues in the same engine
// session without repeating the original message, "Reenviar" sends the original message again in a new run.

export const RESUME_PROMPT =
  "A sua resposta anterior foi interrompida antes do fim. Continue exatamente de onde parou, sem repetir o que já foi escrito.";
export const RESUME_BUBBLE = "Retomar a resposta interrompida";

const REASON_TEXT = {
  restart: "O servidor reiniciou antes do fim.",
  user: "A resposta foi parada.",
  idle: "Ficou tempo demais sem ninguém acompanhando.",
};

/** True for the final event the server sends when a run ended without an answer. @param {any} data */
export function isInterruption(data) {
  return Boolean(data && data.type === "error" && (data.interrupted === true || data.code === "interrupted"));
}

/**
 * Marks an assistant turn as interrupted, keeping its partial text.
 * @param {any} turn @param {any} data the final event @param {{ runId?: string, prompt?: string }} [context]
 */
export function markInterrupted(turn, data, context = {}) {
  const reason = /** @type {keyof typeof REASON_TEXT} */ (data.reason in REASON_TEXT ? data.reason : "restart");
  turn.interrupted = { reason, runId: context.runId || null, prompt: context.prompt || "" };
  turn.phase = "done";
  delete turn.errorInfo;
  return turn;
}

/** @param {string} value */
const escAttr = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Label, reason and the two actions under an interrupted turn.
 * @param {any} turn @param {number} index position in state.chatTurns @param {{ canResume: boolean, busy?: boolean }} options
 */
export function interruptedHtml(turn, index, { canResume, busy = false }) {
  const info = turn && turn.interrupted;
  if (!info) return "";
  const reason = REASON_TEXT[/** @type {keyof typeof REASON_TEXT} */ (info.reason)] || REASON_TEXT.restart;
  const disabled = busy ? " disabled" : "";
  const label = `<div class="interrupted-label"><i class="fa-solid fa-circle-pause" aria-hidden="true"></i> Interrompida <span class="interrupted-reason">${escAttr(reason)}</span></div>`;
  if (info.handled) return `<div class="chat-interrupted" role="status" data-turn="${index}">${label}</div>`;
  const resume = canResume
    ? `<button type="button" class="btn-interrupted-resume" onclick="resumeInterruptedTurn(${index}, this)"${disabled}><i class="fa-solid fa-play"></i> Retomar</button>`
    : "";
  const hint = canResume ? "" : '<div class="interrupted-hint">Este motor não tem sessão para retomar: reenvie a mensagem.</div>';
  return `<div class="chat-interrupted" role="status" data-turn="${index}">
    ${label}
    <div class="interrupted-actions">${resume}<button type="button" class="btn-interrupted-resend" onclick="resendInterruptedTurn(${index}, this)"${disabled}><i class="fa-solid fa-rotate-right"></i> Reenviar</button></div>${hint}
  </div>`;
}

/**
 * The user message that produced an interrupted turn (the nearest user turn before it).
 * @param {any[]} turns @param {number} index
 * @returns {string}
 */
export function originalPrompt(turns, index) {
  for (let i = index - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.role === "user") return String(t.fullPrompt || t.text || "");
  }
  return "";
}

/**
 * What "Retomar" or "Reenviar" sends. Resume needs the engine session; without one it falls back to resend.
 * @param {"resume"|"resend"} action @param {any[]} turns @param {number} index @param {string|null} engineSession
 * @returns {{ prompt: string, displayText?: string, resumedFrom?: string } | null}
 */
export function interruptedAction(action, turns, index, engineSession) {
  const turn = turns[index];
  if (!turn || !turn.interrupted) return null;
  if (action === "resume" && engineSession) {
    return { prompt: RESUME_PROMPT, displayText: RESUME_BUBBLE, resumedFrom: turn.interrupted.runId || undefined };
  }
  const prompt = turn.interrupted.prompt || originalPrompt(turns, index);
  return prompt ? { prompt } : null;
}

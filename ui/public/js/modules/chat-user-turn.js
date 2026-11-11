// @ts-check
// User turn with a short bubble text and the full prompt kept aside (workflow "Executar etapa").
// The engine always receives the full prompt; the bubble shows the short text plus a "Ver prompt" toggle.

/**
 * @param {string} text what is sent to the engine
 * @param {string} [displayText] what the bubble shows instead (optional)
 * @returns {{ role: "user", text: string, fullPrompt?: string }}
 */
export function buildUserTurn(text, displayText) {
  const short = String(displayText || "").trim();
  return short && short !== text ? { role: "user", text: short, fullPrompt: text } : { role: "user", text };
}

/** Text of a turn as the engine must see it (history replay). @param {{ text?: string, fullPrompt?: string }} turn */
export function engineText(turn) {
  return turn.fullPrompt || turn.text || "";
}

/**
 * @param {{ text?: string, fullPrompt?: string }} turn
 * @param {(value: string) => string} esc HTML escaper
 */
export function userBubbleHtml(turn, esc) {
  const body = `<p>${esc(turn.text || "").replace(/\n/g, "<br>")}</p>`;
  const full = turn.fullPrompt
    ? `<details class="chat-full-prompt"><summary><i class="fa-solid fa-file-lines"></i> Ver prompt</summary><pre>${esc(turn.fullPrompt)}</pre></details>`
    : "";
  return `<div class="msg user"><div class="bubble">${body}${full}</div></div>`;
}

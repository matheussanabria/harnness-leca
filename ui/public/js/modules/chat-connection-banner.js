// @ts-check
// "Reconectando ao servidor" banner (EP-23.05). Shown while a chat stream reattaches, with the current attempt, and
// hidden as soon as the stream is back. One banner for the page, so it works in the main chat, the Studio and the
// mini dock alike. It never blocks the screen: role="status", no overlay, no focus change.

const BANNER_ID = "chatReconnectBanner";

/** @returns {HTMLElement | null} */
function bannerEl() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.className = "chat-reconnect-banner";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

/** Text of the banner for an attempt. @param {number} attempt */
export function reconnectText(attempt) {
  return attempt > 1 ? `Reconectando ao servidor (tentativa ${attempt})` : "Reconectando ao servidor";
}

/** @param {number} attempt */
export function showReconnecting(attempt) {
  const el = bannerEl();
  if (!el) return;
  el.innerHTML = `<i class="fa-solid fa-rotate fa-spin" aria-hidden="true"></i> <span>${reconnectText(attempt)}</span>`;
  el.hidden = false;
}

/**
 * A message refused because the host is restarting (EP-23.05 RF4): drop the two turns it added and put the text
 * back in the composer, so nothing typed is lost.
 * @param {any[]} turns state.chatTurns @param {any} assistantTurn @param {string} text @param {{ value: string } | null | undefined} input
 */
export function returnToComposer(turns, assistantTurn, text, input) {
  const at = turns.lastIndexOf(assistantTurn);
  if (at >= 0) {
    const user = turns[at - 1];
    turns.splice(user && user.role === "user" ? at - 1 : at, user && user.role === "user" ? 2 : 1);
  }
  if (input && !input.value) input.value = text;
}

export function hideReconnecting() {
  const el = typeof document === "undefined" ? null : document.getElementById(BANNER_ID);
  if (el) el.hidden = true;
}

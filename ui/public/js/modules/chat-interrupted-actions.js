// @ts-check
// Buttons of an interrupted answer (EP-23.04): "Retomar" and "Reenviar". Exposed on window through chat.js, like the
// other chat actions. The send goes through sendChatMessage in the presentation that holds the clicked button.
import { $, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { CHAT_PRESENTATIONS } from "./chat-presentations.js";
import { getEngineSession } from "./chat-session-store.js";
import { isChatStreamingFor } from "./chat-execution-store.js";
import { switchEngine } from "./chat-engines.js";
import { interruptedAction } from "./chat-interrupted.js";

/** The presentation (main, studio, mini) whose history holds the element. @param {Element|null|undefined} el */
function presentationOf(el) {
  for (const [name, ids] of Object.entries(CHAT_PRESENTATIONS)) {
    if (ids.history && el?.closest?.(`#${ids.history}`)) return name;
  }
  return state.isStudioMode ? "studio" : "main";
}

/** @param {"resume"|"resend"} kind @param {number} index @param {Element} [button] */
async function run(kind, index, button) {
  const P = state.P;
  if (!P) return;
  if (isChatStreamingFor(P.slug, cs.currentChatFile)) return showToast("Aguarde a resposta atual terminar.");
  const turn = state.chatTurns[index];
  const engine = turn?.engine || cs.currentEngine;
  const session = getEngineSession(P.slug, cs.currentChatFile, engine);
  const action = interruptedAction(kind, state.chatTurns, index, session);
  if (!action) return showToast("Não encontrei a mensagem original para reenviar.");
  if (kind === "resume" && !action.displayText) showToast("Sem sessão para retomar: a mensagem foi reenviada.", 5000);
  turn.interrupted.handled = true;
  const presentation = presentationOf(button);
  const input = /** @type {HTMLTextAreaElement|null} */ ($(CHAT_PRESENTATIONS[/** @type {keyof typeof CHAT_PRESENTATIONS} */ (presentation)].input));
  if (input) input.value = action.prompt;
  if (cs.currentEngine !== engine && cs.currentEngine !== "compare") switchEngine(engine);
  const { sendChatMessage } = await import("./chat-send.js");
  await sendChatMessage(presentation, { displayText: action.displayText, resumedFrom: action.resumedFrom });
}

/** Continues the interrupted answer in the same engine session. @param {number} index @param {Element} [button] */
export const resumeInterruptedTurn = (index, button) => run("resume", index, button);

/** Sends the original message again in a new run. @param {number} index @param {Element} [button] */
export const resendInterruptedTurn = (index, button) => run("resend", index, button);

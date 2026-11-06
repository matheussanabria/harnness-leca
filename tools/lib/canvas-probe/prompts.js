// @ts-check
"use strict";
// Builds the exact prompt the app would send, by driving the real bridge with the scenario's canvas state.

/** @param {{ bridge: any }} env @param {any} scenario @param {{ resumed?: boolean }} [opts] */
function buildPrompt(env, scenario, opts = {}) {
  const { bridge } = env;
  bridge.setCanvasChatContext({ kind: scenario.kind, slug: "probe" });
  window.dispatchEvent(new CustomEvent(bridge.CANVAS_STATE_EVENT, { detail: { ...scenario.state, kind: scenario.kind } }));
  const first = bridge.wrapCanvasPrompt(scenario.history ? scenario.history.request : scenario.request);
  if (!scenario.history || opts.resumed === false) return first;
  // One-shot engines have no session, so a resumed chat is approximated with a transcript: the first turn (with the
  // rules), the canned answer, then the follow-up as the app sends it on a resumed session (the rules are NOT repeated).
  const followUp = bridge.wrapCanvasPrompt(scenario.request, { resumed: true });
  return `Conversa até aqui:\n\n[Usuário]\n${first}\n\n[Assistente]\n${scenario.history.answer}\n\n[Usuário]\n${followUp}`;
}

module.exports = { buildPrompt };

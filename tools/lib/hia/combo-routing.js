// @ts-check
// Decides whether a chat turn runs on the suggested 9Router combo instead of the model picked in the UI.
// Off unless HIA_COMBO_ROUTING=true. Only the opencode engine, and only when the picked model is a "route for me"
// model (HIA_COMBO_ROUTING_FROM, default 9router/harness-implementacao: the opencode.json default model, since the
// old general "Harness" combo no longer exists in 9Router). A conversation keeps its combo on follow-up turns:
// the choice is remembered by the opencode session id, which the engine returns on done and the client sends back.
const { GENERAL_COMBO } = require("./combo-map");

const DEFAULT_TRIGGER = "9router/harness-implementacao";
const MAX_SESSIONS = 500;
/** opencode session id -> model ref chosen on the conversation's first turn (in memory; resets on restart). */
const sessionCombos = new Map();

/** @param {string} sessionId @param {string} modelRef */
function rememberCombo(sessionId, modelRef) {
  if (!sessionId || !modelRef) return;
  sessionCombos.delete(sessionId);
  sessionCombos.set(sessionId, modelRef);
  if (sessionCombos.size > MAX_SESSIONS) sessionCombos.delete(sessionCombos.keys().next().value);
}

/**
 * @param {{
 *   engine: string,
 *   model?: string,
 *   sessionId?: string,
 *   suggestion?: { combo: string, modelRef: string },
 *   env?: Record<string, string | undefined>,
 * }} o
 * @returns {string} model ref to use instead of the picked one, or "" to keep the picked model
 */
function resolveComboModel({ engine, model = "", sessionId = "", suggestion, env = process.env }) {
  if (env.HIA_COMBO_ROUTING !== "true" || engine !== "opencode") return "";
  const from = (env.HIA_COMBO_ROUTING_FROM || DEFAULT_TRIGGER).split(",").map((s) => s.trim()).filter(Boolean);
  // A follow-up turn keeps the combo even if the UI still shows the "route for me" model.
  if (sessionId && sessionCombos.has(sessionId)) return from.includes(model) ? /** @type {string} */ (sessionCombos.get(sessionId)) : "";
  if (!from.includes(model)) return "";
  if (!suggestion || suggestion.combo === GENERAL_COMBO) return "";
  return suggestion.modelRef;
}

/** Test helper. */
const resetComboMemory = () => sessionCombos.clear();

module.exports = { resolveComboModel, rememberCombo, resetComboMemory };

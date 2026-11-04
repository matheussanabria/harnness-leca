// @ts-check
// Who made a change: `human:<id>` or `agent:<engine>:<run>`. Recorded on transitions; a claim, not a verified identity.
const ACTOR_RE = /^(human:[A-Za-z0-9._-]{1,64}|agent:[a-z0-9-]{1,32}:[A-Za-z0-9._-]{1,80})$/;

/** @param {unknown} value @returns {string | null} null when absent; throws on a malformed value */
function normalizeActor(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !ACTOR_RE.test(value)) {
    throw new Error("Actor invalido: use human:<id> ou agent:<engine>:<run>.");
  }
  return value;
}

/** @param {string | null} actor */
const isAgentActor = (actor) => typeof actor === "string" && actor.startsWith("agent:");

const LEDGER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

/** Id of the coordination-ledger card that tracks this story (e.g. EP-19.03); invalid values are dropped. */
function normalizeLedgerId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return LEDGER_ID_RE.test(id) ? id : null;
}

module.exports = { normalizeActor, isAgentActor, normalizeLedgerId, ACTOR_RE };

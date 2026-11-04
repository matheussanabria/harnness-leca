'use strict';
// Agents may draft and move work forward; approving it (ready, deploy, done) needs a human actor.
const { normalizeActor, isAgentActor } = require('../../../ui/server/services/project-scrum-actor');

const HUMAN_ONLY_LANES = new Set(['pronto-para-deploy', 'concluido']);

class GuardError extends Error {}

function requireActor(value) {
  const actor = normalizeActor(value);
  if (!actor) throw new Error('--actor is required for writes (human:<id> or agent:<engine>:<run>).');
  return actor;
}

function assertMaturity(actor, maturity) {
  if (maturity === 'ready' && isAgentActor(actor)) throw new GuardError('Marking a story ready needs a human actor.');
}

function assertLane(actor, toLaneId) {
  if (HUMAN_ONLY_LANES.has(toLaneId) && isAgentActor(actor)) throw new GuardError(`Moving to '${toLaneId}' needs a human actor.`);
}

module.exports = { GuardError, requireActor, assertMaturity, assertLane };

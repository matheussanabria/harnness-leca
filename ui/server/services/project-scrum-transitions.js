// @ts-check
// Regras puras do workflow: a ordem canônica não depende da posição visual configurada.
const { CANONICAL_LANES, isLaneId, mergeLaneConfiguration } = require("./project-scrum-lanes");

const LANE_INDEX = new Map(CANONICAL_LANES.map((lane, index) => [lane.id, index]));
const LANE_STATUS = Object.freeze({
  backlog: "todo",
  discovery: "todo",
  refinamento: "todo",
  "pronto-para-dev": "todo",
  "em-desenvolvimento": "in_progress",
  "em-revisao": "review",
  "pronto-para-testes": "review",
  "em-testes": "review",
  "pronto-para-homologacao": "review",
  "em-homologacao": "review",
  "pronto-para-deploy": "review",
  concluido: "done",
});

function laneToLegacyStatus(laneId) {
  if (!isLaneId(laneId)) throw new Error(`Raia '${laneId}' invalida.`);
  return LANE_STATUS[laneId];
}

function allowedTransitionLaneIds(laneId, lanes) {
  if (!isLaneId(laneId)) return { backward: null, forward: null };
  const configured = new Map(mergeLaneConfiguration(lanes).map((lane) => [lane.id, lane]));
  if (!configured.get(laneId)?.active) return { backward: null, forward: null };
  const index = LANE_INDEX.get(laneId);
  const available = (offset) => {
    const id = CANONICAL_LANES[index + offset]?.id;
    return id && configured.get(id)?.active ? id : null;
  };
  return { backward: available(-1), forward: available(1) };
}

function validateStoryTransition(actualLaneId, expectedLaneId, targetLaneId, lanes) {
  if (!isLaneId(actualLaneId) || !isLaneId(targetLaneId)) throw new Error("Origem ou destino da transicao e invalido.");
  if (!isLaneId(expectedLaneId)) throw new Error("A raia de origem esperada e obrigatoria.");
  if (actualLaneId !== expectedLaneId) {
    throw Object.assign(new Error("A historia foi movida por outra sessao. Recarregue o quadro."), {
      code: "SCRUM_STORY_CONFLICT", currentLaneId: actualLaneId,
    });
  }
  if (actualLaneId === targetLaneId) throw new Error("A historia ja esta nessa raia.");
  const configured = new Map(mergeLaneConfiguration(lanes).map((lane) => [lane.id, lane]));
  if (!configured.get(actualLaneId)?.active || !configured.get(targetLaneId)?.active) {
    throw new Error("Raias inativas nao permitem transicoes.");
  }
  if (Math.abs(LANE_INDEX.get(actualLaneId) - LANE_INDEX.get(targetLaneId)) !== 1) {
    throw new Error("A transicao deve ocorrer entre etapas adjacentes do workflow.");
  }
  return { fromLaneId: actualLaneId, toLaneId: targetLaneId, toStatus: laneToLegacyStatus(targetLaneId) };
}

function createTransitionRecord(story, transition, occurredAt = new Date().toISOString(), actor = null) {
  return {
    id: `${story.id}:${occurredAt}:${transition.toLaneId}`,
    storyId: story.id,
    storyKey: story.key,
    fromLaneId: transition.fromLaneId,
    toLaneId: transition.toLaneId,
    fromStatus: story.status,
    toStatus: transition.toStatus,
    occurredAt,
    storySource: story.source || story.origin || "local",
    ...(actor ? { actor } : {}),
  };
}

module.exports = { allowedTransitionLaneIds, createTransitionRecord, laneToLegacyStatus, validateStoryTransition };

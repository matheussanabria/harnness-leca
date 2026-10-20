// @ts-check
const crypto = require("crypto");

const ACTIVE = new Set(["claimed", "in_progress", "review"]);

function nowIso(now) {
  return (now || new Date()).toISOString();
}

function makeEvent(type, provider, storyId, payload = {}, eventId) {
  return {
    id: eventId || crypto.randomUUID(),
    type,
    provider,
    storyId: storyId || null,
    payload,
    at: nowIso(),
  };
}

function assertProvider(state, provider) {
  const record = state.providers[provider];
  if (!record) throw new Error(`Provedor desconhecido: ${provider}`);
  if (!record.enabled) throw new Error(`Provedor ${provider} esta cadastrado, mas inativo: ${record.reason}`);
}

function story(state, id) {
  const item = state.stories[id];
  if (!item) throw new Error(`Historia desconhecida: ${id}`);
  return item;
}

function lease(provider, minutes, at) {
  return {
    provider,
    acquiredAt: at,
    expiresAt: new Date(Date.parse(at) + minutes * 60000).toISOString(),
  };
}

function reduce(state, event) {
  if (state.processedEventIds.includes(event.id)) return false;
  assertProvider(state, event.provider);
  const at = event.at;
  if (event.type === "story.claimed") {
    const item = story(state, event.storyId);
    if (item.status === "done") throw new Error(`${item.id} ja esta concluida.`);
    if (item.owner && item.owner !== event.provider) {
      throw new Error(`${item.id} pertence a ${item.owner}; handoff ou reatribuicao e necessario.`);
    }
    const pending = item.dependencies.filter((id) => state.stories[id]?.status !== "done");
    if (pending.length) throw new Error(`${item.id} depende de: ${pending.join(", ")}.`);
    if (item.lease && Date.parse(item.lease.expiresAt) > Date.parse(at) && item.lease.provider !== event.provider) {
      throw new Error(`${item.id} possui lease ativo de ${item.lease.provider}.`);
    }
    item.owner = event.provider;
    item.status = "claimed";
    item.lease = lease(event.provider, event.payload.leaseMinutes || 120, at);
    item.updatedAt = at;
  } else if (event.type === "story.started" || event.type === "story.heartbeat") {
    const item = story(state, event.storyId);
    if (!item.lease || item.lease.provider !== event.provider) throw new Error(`${item.id} nao foi reivindicada por ${event.provider}.`);
    item.status = event.type === "story.started" ? "in_progress" : item.status;
    item.lease = lease(event.provider, event.payload.leaseMinutes || 120, at);
    item.updatedAt = at;
  } else if (event.type === "story.blocked") {
    const item = story(state, event.storyId);
    if (item.owner !== event.provider) throw new Error(`${event.provider} nao e responsavel por ${item.id}.`);
    item.status = "blocked";
    item.lease = null;
    item.blocker = event.payload.reason;
    item.updatedAt = at;
  } else if (event.type === "story.completed") {
    const item = story(state, event.storyId);
    if (item.owner !== event.provider) throw new Error(`${event.provider} nao e responsavel por ${item.id}.`);
    if (!event.payload.evidence) throw new Error("Conclusao exige --evidence.");
    item.status = "done";
    item.lease = null;
    item.evidence.push(event.payload.evidence);
    item.updatedAt = at;
  } else if (event.type === "handoff.created") {
    const item = story(state, event.storyId);
    if (item.owner !== event.provider) throw new Error(`${event.provider} nao e responsavel por ${item.id}.`);
    const target = event.payload.to;
    assertProvider(state, target);
    item.owner = target;
    item.status = item.status === "done" ? "done" : "ready";
    item.lease = null;
    item.updatedAt = at;
    state.messages.push({
      id: event.id,
      type: "handoff",
      from: event.provider,
      to: target,
      storyId: item.id,
      message: event.payload.message,
      createdAt: at,
      readAt: null,
    });
  } else if (event.type === "message.sent") {
    const target = event.payload.to;
    assertProvider(state, target);
    if (event.storyId) story(state, event.storyId);
    state.messages.push({
      id: event.id,
      type: "notification",
      from: event.provider,
      to: target,
      storyId: event.storyId,
      message: event.payload.message,
      createdAt: at,
      readAt: null,
    });
  } else if (event.type === "inbox.read") {
    for (const message of state.messages) {
      if (message.to === event.provider && !message.readAt) message.readAt = at;
    }
  } else {
    throw new Error(`Evento desconhecido: ${event.type}`);
  }
  state.processedEventIds.push(event.id);
  state.processedEventIds = state.processedEventIds.slice(-1000);
  state.revision += 1;
  state.updatedAt = at;
  return true;
}

module.exports = { ACTIVE, makeEvent, reduce };

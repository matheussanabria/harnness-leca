// @ts-check
const fs = require("fs");
const path = require("path");
const { PROVIDERS, normalizeProvider } = require("./config");
const { readBacklog } = require("./backlog");
const { paths, atomicJson, loadState, acquireLock, appendEvent } = require("./storage");
const { makeEvent, reduce } = require("./reducer");
const { project: writeProjection } = require("./projection");

function ensureProject(root, project) {
  const dir = path.join(root, "projects", project);
  if (!fs.existsSync(dir)) throw new Error(`Projeto nao encontrado: ${project}`);
}

function init(root, project) {
  ensureProject(root, project);
  const release = acquireLock(root, project);
  try {
    const existing = loadState(root, project);
    if (existing) {
      writeProjection(root, project, existing);
      return existing;
    }
    const at = new Date().toISOString();
    const state = {
      schemaVersion: 1,
      project,
      revision: 0,
      createdAt: at,
      updatedAt: at,
      providers: JSON.parse(JSON.stringify(PROVIDERS)),
      stories: readBacklog(root),
      messages: [],
      processedEventIds: [],
    };
    atomicJson(paths(root, project).state, state);
    appendEvent(root, project, "system", {
      id: `init-${project}-${at}`,
      type: "ledger.initialized",
      provider: "system",
      storyId: null,
      payload: { stories: Object.keys(state.stories).length },
      at,
    });
    writeProjection(root, project, state);
    return state;
  } finally {
    release();
  }
}

function get(root, project) {
  return loadState(root, project) || init(root, project);
}

function sync(root, project) {
  const release = acquireLock(root, project);
  try {
    const state = loadState(root, project);
    if (!state) throw new Error("Ledger nao inicializado. Execute o comando init.");
    const backlog = readBacklog(root);
    state.providers = JSON.parse(JSON.stringify(PROVIDERS));
    for (const [id, imported] of Object.entries(backlog)) {
      if (!state.stories[id]) state.stories[id] = imported;
      else {
        state.stories[id].title = imported.title;
        state.stories[id].document = imported.document;
        state.stories[id].dependencies = imported.dependencies;
        // Owner declarado no config: reconcilia quando a historia nao esta em trabalho.
        const active = ["claimed", "in_progress", "review"].includes(state.stories[id].status);
        if (!active && imported.owner && state.stories[id].owner !== imported.owner) {
          state.stories[id].owner = imported.owner;
          state.stories[id].lease = null;
        }
        if (imported.status === "done" && state.stories[id].status !== "done") {
          state.stories[id].status = "done";
          state.stories[id].lease = null;
          state.stories[id].evidence.push("Importado do indice mestre");
        }
      }
    }
    state.revision += 1;
    state.updatedAt = new Date().toISOString();
    atomicJson(paths(root, project).state, state);
    appendEvent(root, project, "system", {
      id: `sync-${project}-${state.revision}`,
      type: "backlog.synchronized",
      provider: "system",
      storyId: null,
      payload: { stories: Object.keys(backlog).length },
      at: state.updatedAt,
    });
    writeProjection(root, project, state);
    return state;
  } finally {
    release();
  }
}

function mutate(root, project, input) {
  const provider = normalizeProvider(input.provider);
  const release = acquireLock(root, project);
  try {
    const state = loadState(root, project);
    if (!state) throw new Error("Ledger nao inicializado. Execute o comando init.");
    const event = makeEvent(input.type, provider, input.storyId, input.payload, input.eventId);
    const changed = reduce(state, event);
    if (changed) {
      atomicJson(paths(root, project).state, state);
      appendEvent(root, project, provider, event);
      writeProjection(root, project, state);
    }
    return { state, event, changed };
  } finally {
    release();
  }
}

function inbox(root, project, provider, consume = false) {
  const normalized = normalizeProvider(provider);
  const state = get(root, project);
  if (!state.providers[normalized]) throw new Error(`Provedor desconhecido: ${provider}`);
  const messages = state.messages.filter((item) => item.to === normalized && !item.readAt);
  if (consume && messages.length) mutate(root, project, { type: "inbox.read", provider: normalized, payload: {} });
  return messages;
}

module.exports = { init, get, sync, mutate, inbox };

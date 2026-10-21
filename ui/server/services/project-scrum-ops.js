// @ts-check
// Mutacoes locais: o snapshot Jira e a documentacao permanecem somente-leitura.
const { sanitizeStory } = require("./project-scrum-sanitize");
const { loadProjectScrum, loadStoredProjectScrum, saveProjectScrum } = require("./project-scrum-persist");
const { isLegacyStatus, legacyStatusToLane } = require("./project-scrum-migration");
const { isLaneId, mergeLaneConfiguration, reorderLaneConfiguration, validateLaneConfiguration } = require("./project-scrum-lanes");
const { createTransitionRecord, validateStoryTransition } = require("./project-scrum-transitions");

function sameStory(story, id) {
  return story.id === id || story.key === id;
}

function findResolved(slug, projectDir, repoRoot, id) {
  return loadProjectScrum(slug, projectDir, repoRoot).scrum.stories.find((story) => sameStory(story, id));
}

function localEntry(data, resolved) {
  let entry = data.stories.find((story) => sameStory(story, resolved.id) || story.key === resolved.key);
  if (!entry) {
    entry = {
      id: resolved.id,
      key: resolved.key,
      sourceKey: resolved.key,
      sprintId: null,
      status: resolved.status,
      laneId: legacyStatusToLane(resolved.status),
    };
    data.stories.push(entry);
  }
  return entry;
}

function persistAndReload(slug, projectDir, repoRoot, data) {
  saveProjectScrum(slug, projectDir, data);
  return loadProjectScrum(slug, projectDir, repoRoot);
}

function upsertStory(slug, projectDir, repoRoot, payload) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const identity = payload.id || payload.key;
  const resolved = identity ? findResolved(slug, projectDir, repoRoot, identity) : null;
  if (resolved && payload.status !== undefined && payload.status !== resolved.status) {
    throw new Error("Use o comando de transicao para alterar a etapa da historia.");
  }
  if (resolved?.source === "jira-snapshot") {
    const entry = localEntry(data, resolved);
    entry.sprintId = payload.sprintId ?? entry.sprintId ?? null;
    const previousStatus = entry.status || resolved.status;
    entry.status = payload.status || previousStatus;
    entry.laneId = payload.status !== undefined && entry.status !== previousStatus
      ? legacyStatusToLane(entry.status)
      : (isLaneId(entry.laneId) ? entry.laneId : resolved.laneId);
    entry.localOverrides = {
      ...(entry.localOverrides || {}),
      ...Object.fromEntries(["title", "description", "acceptanceCriteria", "epicId", "points", "priority", "assignee"]
        .filter((field) => payload[field] !== undefined)
        .map((field) => [field, payload[field]])),
    };
    entry.updatedAt = new Date().toISOString();
  } else {
    const sanitizedStory = sanitizeStory(payload, data.activeSprintId);
    const existing = data.stories.find((story) => sameStory(story, sanitizedStory.id) || story.key === sanitizedStory.key);
    const sanitized = {
      ...sanitizedStory,
      laneId: existing && existing.status === sanitizedStory.status && isLaneId(existing.laneId)
        ? existing.laneId
        : legacyStatusToLane(sanitizedStory.status),
      origin: "local",
    };
    const index = data.stories.findIndex((story) => sameStory(story, sanitized.id) || story.key === sanitized.key);
    if (index >= 0) data.stories[index] = { ...data.stories[index], ...sanitized, updatedAt: new Date().toISOString() };
    else data.stories.unshift(sanitized);
  }
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function updateStoryStatus(slug, projectDir, repoRoot, storyId, requestedStatus) {
  if (!isLegacyStatus(requestedStatus)) throw new Error(`Status '${requestedStatus}' invalido.`);
  const resolved = findResolved(slug, projectDir, repoRoot, storyId);
  if (!resolved) throw new Error(`Historia '${storyId}' nao encontrada.`);
  return moveStoryToLane(slug, projectDir, repoRoot, storyId, resolved.laneId, legacyStatusToLane(requestedStatus));
}

function moveStoryToLane(slug, projectDir, repoRoot, storyId, expectedLaneId, targetLaneId, now) {
  const resolved = findResolved(slug, projectDir, repoRoot, storyId);
  if (!resolved) throw new Error(`Historia '${storyId}' nao encontrada.`);
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const transition = validateStoryTransition(resolved.laneId, expectedLaneId, targetLaneId, data.lanes);
  const entry = resolved.source === "jira-snapshot" ? localEntry(data, resolved) : data.stories.find((story) => sameStory(story, storyId));
  entry.status = transition.toStatus;
  entry.laneId = transition.toLaneId;
  entry.updatedAt = new Date().toISOString();
  data.transitionHistory = [
    ...(Array.isArray(data.transitionHistory) ? data.transitionHistory : []),
    createTransitionRecord(resolved, transition, now),
  ];
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function assignStorySprint(slug, projectDir, repoRoot, storyId, sprintId) {  const resolved = findResolved(slug, projectDir, repoRoot, storyId);
  if (!resolved) throw new Error(`Historia '${storyId}' nao encontrada.`);
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const entry = resolved.source === "jira-snapshot" ? localEntry(data, resolved) : data.stories.find((story) => sameStory(story, storyId));
  entry.sprintId = sprintId || null;
  entry.updatedAt = new Date().toISOString();
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function setStoryImpediment(slug, projectDir, repoRoot, storyId, active, reason, now) {
  const resolved = findResolved(slug, projectDir, repoRoot, storyId);
  if (!resolved) throw new Error(`Historia '${storyId}' nao encontrada.`);
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const entry = resolved.source === "jira-snapshot" ? localEntry(data, resolved) : data.stories.find((story) => sameStory(story, storyId));
  const current = entry.impediment || null;
  const isActive = Boolean(active);
  const trimmedReason = String(reason || "").trim();
  if (isActive && !trimmedReason) throw new Error("Informe o motivo do impedimento.");
  if (isActive === Boolean(current?.active) && (!isActive || trimmedReason === current.reason)) {
    return loadProjectScrum(slug, projectDir, repoRoot);
  }

  const occurredAt = now || new Date().toISOString();
  entry.impediment = isActive
    ? { active: true, reason: trimmedReason, since: current?.active ? current.since : occurredAt, resolvedAt: null }
    : null;
  entry.updatedAt = occurredAt;
  data.impedimentHistory = [
    ...(Array.isArray(data.impedimentHistory) ? data.impedimentHistory : []),
    {
      id: `${resolved.id}:${occurredAt}:${isActive ? "activate" : "resolve"}`,
      storyId: resolved.id,
      storyKey: resolved.key,
      active: isActive,
      reason: trimmedReason || current?.reason || "",
      occurredAt,
      storySource: resolved.source || "local",
    },
  ];
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function deleteStory(slug, projectDir, repoRoot, storyId) {
  const resolved = findResolved(slug, projectDir, repoRoot, storyId);
  if (!resolved) throw new Error(`Historia '${storyId}' nao encontrada.`);
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  data.stories = data.stories.filter((story) => !sameStory(story, storyId) && story.key !== resolved.key);
  if (resolved.source === "jira-snapshot") {
    data.deletedSourceKeys = [...new Set([...(data.deletedSourceKeys || []), resolved.key])];
  }
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function upsertEpic(slug, projectDir, repoRoot, payload) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const id = String(payload.id || `epic-${Date.now()}`);
  const epic = { id, title: String(payload.title || "Novo Epico").trim(), description: String(payload.description || "").trim(), color: payload.color || "#6366f1" };
  const index = data.epics.findIndex((item) => item.id === id);
  if (index >= 0) data.epics[index] = epic;
  else data.epics.push(epic);
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function upsertSprint(slug, projectDir, repoRoot, payload) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const id = String(payload.id || `sprint-${Date.now()}`);
  const sprint = {
    id,
    name: String(payload.name || `Sprint ${data.sprints.length + 1}`).trim(),
    goal: String(payload.goal || "").trim(),
    startDate: payload.startDate || new Date().toISOString().split("T")[0],
    endDate: payload.endDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    status: payload.status || "active",
  };
  const index = data.sprints.findIndex((item) => item.id === id);
  if (index >= 0) data.sprints[index] = sprint;
  else data.sprints.push(sprint);
  if (payload.makeActive || !data.activeSprintId) data.activeSprintId = id;
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function updateStatusMapping(slug, projectDir, repoRoot, mapping) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  if (Object.values(mapping).some((laneId) => !isLaneId(laneId))) throw new Error("Mapeamento contem raia invalida.");
  data.statusMapping = { ...(data.statusMapping || {}), ...mapping };
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function assertLaneRevision(data, expectedRevision) {
  const currentRevision = Number.isInteger(data.lanesRevision) ? data.lanesRevision : 0;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("Revisao de raias invalida.");
  if (expectedRevision !== currentRevision) {
    throw Object.assign(new Error("As raias foram alteradas por outra sessao. Recarregue o quadro."), {
      code: "SCRUM_LANES_CONFLICT", currentRevision,
    });
  }
  return currentRevision;
}

function updateLanes(slug, projectDir, repoRoot, lanes, expectedRevision) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const revision = assertLaneRevision(data, expectedRevision);
  const configured = new Map(validateLaneConfiguration(lanes).map((lane) => [lane.id, lane]));
  data.lanes = mergeLaneConfiguration(data.lanes).map((lane) => ({ ...configured.get(lane.id), order: lane.order }));
  data.lanesRevision = revision + 1;
  return persistAndReload(slug, projectDir, repoRoot, data);
}

function reorderLanes(slug, projectDir, repoRoot, laneIds, expectedRevision) {
  const data = loadStoredProjectScrum(slug, projectDir, repoRoot);
  const revision = assertLaneRevision(data, expectedRevision);
  data.lanes = reorderLaneConfiguration(data.lanes, laneIds);
  data.lanesRevision = revision + 1;
  return persistAndReload(slug, projectDir, repoRoot, data);
}

module.exports = { upsertStory, updateStoryStatus, moveStoryToLane, assignStorySprint, setStoryImpediment, deleteStory, upsertEpic, upsertSprint, updateStatusMapping, updateLanes, reorderLanes };

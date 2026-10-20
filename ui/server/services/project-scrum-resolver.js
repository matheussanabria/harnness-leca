// @ts-check
// Reconcilia fontes sem confundir dados externos com estado e edicoes locais.
const { legacyStatusToLane } = require("./project-scrum-migration");
const { isLaneId, mergeLaneConfiguration } = require("./project-scrum-lanes");

function defaultBoardStatus(sourceStatus) {
  const category = sourceStatus?.category;
  if (category === "done") return "done";
  if (category === "indeterminate") return "in_progress";
  return "todo";
}

function statusMapping(local, snapshot) {
  const saved = local.statusMapping || {};
  const statuses = new Map();
  for (const story of snapshot.stories || []) {
    const status = story.sourceStatus;
    if (!status) continue;
    const key = status.id || status.name;
    const storedLaneId = legacyStatusToLane(saved[key]) || (isLaneId(saved[key]) ? saved[key] : null);
    if (!statuses.has(key)) statuses.set(key, {
      ...status,
      boardLaneId: storedLaneId || legacyStatusToLane(defaultBoardStatus(status)),
    });
  }
  return [...statuses.values()];
}

function mergeSourceStory(source, localStory, document, mapping) {
  const override = localStory?.localOverrides || {};
  const mapped = mapping.find((item) => (item.id || item.name) === (source.sourceStatus?.id || source.sourceStatus?.name));
  const status = localStory?.status || defaultBoardStatus(source.sourceStatus);
  const merged = {
    ...source,
    sprintId: localStory?.sprintId ?? null,
    status,
    laneId: isLaneId(localStory?.laneId) ? localStory.laneId : (mapped?.boardLaneId ?? legacyStatusToLane(status)),
    context: document?.context ?? null,
    description: document?.description ?? source.description,
    userStory: document?.userStory ?? null,
    acceptanceCriteria: document?.acceptanceCriteria || [],
    scenarios: document?.scenarios || [],
    outOfScope: document?.outOfScope ?? null,
    additionalInfo: document?.additionalInfo ?? null,
    documentLinks: document?.documentLinks || [],
    documentationFile: document?.sourceFile || null,
    ...override,
  };
  merged.acceptanceCriteriaCount = merged.acceptanceCriteria.length;
  merged.scenarioCount = merged.scenarios.length;
  merged.relationshipCount = merged.relationships.length;
  merged.provenance = {
    title: override.title !== undefined ? "local-override" : "jira-snapshot",
    sourceStatus: "jira-snapshot",
    relationships: "jira-snapshot",
    context: document?.context ? "documentation" : "unavailable",
    description: override.description !== undefined ? "local-override" : (document?.description ? "documentation" : "unavailable"),
    userStory: document?.userStory ? "documentation" : "unavailable",
    acceptanceCriteria: override.acceptanceCriteria !== undefined ? "local-override" : (document?.acceptanceCriteria?.length ? "documentation" : "unavailable"),
    scenarios: document?.scenarios?.length ? "documentation" : "unavailable",
    outOfScope: document?.outOfScope ? "documentation" : "unavailable",
    additionalInfo: document?.additionalInfo ? "documentation" : "unavailable",
  };
  return merged;
}

function resolveScrumData(local = {}, snapshot = {}, documents = new Map()) {
  const localStories = Array.isArray(local.stories) ? local.stories : [];
  const byKey = new Map(localStories.map((story) => [String(story.key || story.id).toUpperCase(), story]));
  const mapping = statusMapping(local, snapshot);
  const sourceKeys = new Set();
  const deleted = new Set((local.deletedSourceKeys || []).map((key) => String(key).toUpperCase()));
  const stories = (snapshot.stories || []).filter((source) => !deleted.has(source.key.toUpperCase())).map((source) => {
    sourceKeys.add(source.key.toUpperCase());
    return mergeSourceStory(source, byKey.get(source.key.toUpperCase()), documents.get(source.key.toUpperCase()), mapping);
  });
  stories.push(...localStories
    .filter((story) => !sourceKeys.has(String(story.key || story.id).toUpperCase()))
    .map((story) => ({ ...story, laneId: isLaneId(story.laneId) ? story.laneId : legacyStatusToLane(story.status) })));

  const sourceEpics = snapshot.epics || [];
  const sourceEpicIds = new Set(sourceEpics.map((epic) => epic.id));
  const epics = [...sourceEpics, ...(local.epics || []).filter((epic) => !sourceEpicIds.has(epic.id))];
  return {
    schemaVersion: local.schemaVersion,
    migrationHistory: local.migrationHistory || [],
    activeSprintId: local.activeSprintId || local.sprints?.[0]?.id || null,
    sprints: local.sprints || [],
    epics,
    stories,
    lanes: mergeLaneConfiguration(local.lanes),
    lanesRevision: Number.isInteger(local.lanesRevision) ? local.lanesRevision : 0,
    transitionHistory: Array.isArray(local.transitionHistory) ? local.transitionHistory : [],
    statusMapping: Object.fromEntries(mapping.map((item) => [item.id || item.name, item.boardLaneId])),
    sourceStatuses: mapping,
    source: snapshot.meta || null,
  };
}

module.exports = { resolveScrumData };

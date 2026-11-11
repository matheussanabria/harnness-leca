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

const NAME_LANES = [
  [/impediment/, "backlog"], [/^a fazer$|^to do$/, "discovery"], [/selecionado|priorizado/, "refinamento"],
  [/desenvolvimento|in progress/, "em-desenvolvimento"], [/revis/, "em-revisao"], [/^em testes?$/, "em-testes"],
  [/^testado$/, "pronto-para-homologacao"], [/^em homologa/, "em-homologacao"], [/^homologado$/, "pronto-para-deploy"],
  [/conclu|cancelad|^done$/, "concluido"],
];

/** Raia padrao pelo nome do status do Jira; cai na categoria quando o nome e desconhecido. */
function defaultLaneForStatus(status) {
  const name = String(status?.name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const hit = NAME_LANES.find(([pattern]) => pattern.test(name));
  return hit ? hit[1] : legacyStatusToLane(defaultBoardStatus(status));
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
      boardLaneId: storedLaneId || defaultLaneForStatus(status),
    });
  }
  return [...statuses.values()];
}

/** Mover localmente vence o Jira so quando houve transicao registrada para essa raia; o resto e semente antiga. */
function hasLocalMove(localStory, transitions) {
  const key = String(localStory?.key || localStory?.id || "").toUpperCase();
  return isLaneId(localStory?.laneId) && transitions.some((move) =>
    String(move.storyKey || move.storyId).toUpperCase() === key && move.toLaneId === localStory.laneId);
}

function mergeSourceStory(source, localStory, document, mapping, transitions = []) {
  const override = localStory?.localOverrides || {};
  const mapped = mapping.find((item) => (item.id || item.name) === (source.sourceStatus?.id || source.sourceStatus?.name));
  const moved = hasLocalMove(localStory, transitions);
  const status = localStory?.status || defaultBoardStatus(source.sourceStatus);
  const merged = {
    ...source,
    sprintId: source.sprintId ?? localStory?.sprintId ?? null,
    status,
    laneId: moved ? localStory.laneId : (mapped?.boardLaneId ?? defaultLaneForStatus(source.sourceStatus)),
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
    impediment: localStory?.impediment ?? null,
  };
  merged.acceptanceCriteriaCount = merged.acceptanceCriteria.length;
  merged.scenarioCount = merged.scenarios.length;
  merged.relationshipCount = merged.relationships.length;
  merged.provenance = {
    sprint: source.sprintId ? "jira-snapshot" : (localStory?.sprintId ? "local" : "unavailable"),
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

const { currentSprint } = require("./project-scrum-jira-sprints");

const JIRA_STATE = { active: "active", closed: "completed", future: "planned" };

function mergeSprints(localSprints = [], jiraSprints = []) {
  const jira = jiraSprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal || "",
    startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : null,
    endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : null,
    status: JIRA_STATE[sprint.state] || "planned",
    source: "jira-snapshot",
  }));
  return [...jira, ...localSprints.filter((sprint) => !jira.some((item) => item.id === sprint.id))];
}

function activeSprintId(local, jiraSprints = [], merged = []) {
  if (local.activeSprintId && merged.some((sprint) => sprint.id === local.activeSprintId) && !jiraSprints.length) return local.activeSprintId;
  return currentSprint(jiraSprints)?.id || local.activeSprintId || merged[0]?.id || null;
}

function resolveScrumData(local = {}, snapshot = {}, documents = new Map()) {
  const localStories = Array.isArray(local.stories) ? local.stories : [];
  const byKey = new Map(localStories.map((story) => [String(story.key || story.id).toUpperCase(), story]));
  const mapping = statusMapping(local, snapshot);
  const sourceKeys = new Set();
  const deleted = new Set((local.deletedSourceKeys || []).map((key) => String(key).toUpperCase()));
  const stories = (snapshot.stories || []).filter((source) => !deleted.has(source.key.toUpperCase())).map((source) => {
    sourceKeys.add(source.key.toUpperCase());
    return mergeSourceStory(source, byKey.get(source.key.toUpperCase()), documents.get(source.key.toUpperCase()), mapping, local.transitionHistory || []);
  });
  stories.push(...localStories
    .filter((story) => !sourceKeys.has(String(story.key || story.id).toUpperCase()))
    .map((story) => ({ ...story, laneId: isLaneId(story.laneId) ? story.laneId : legacyStatusToLane(story.status) })));

  const sourceEpics = snapshot.epics || [];
  const sourceEpicIds = new Set(sourceEpics.map((epic) => epic.id));
  const epics = [...sourceEpics, ...(local.epics || []).filter((epic) => !sourceEpicIds.has(epic.id))];
  const sprints = mergeSprints(local.sprints, snapshot.sprints);
  return {
    schemaVersion: local.schemaVersion,
    migrationHistory: local.migrationHistory || [],
    activeSprintId: activeSprintId(local, snapshot.sprints, sprints),
    sprints,
    epics,
    stories,
    lanes: mergeLaneConfiguration(local.lanes),
    lanesRevision: Number.isInteger(local.lanesRevision) ? local.lanesRevision : 0,
    transitionHistory: Array.isArray(local.transitionHistory) ? local.transitionHistory : [],
    impedimentHistory: Array.isArray(local.impedimentHistory) ? local.impedimentHistory : [],
    statusMapping: Object.fromEntries(mapping.map((item) => [item.id || item.name, item.boardLaneId])),
    sourceStatuses: mapping,
    source: snapshot.meta || null,
  };
}

module.exports = { resolveScrumData };

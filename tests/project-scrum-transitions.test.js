// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");
const {
  allowedTransitionLaneIds,
  laneToLegacyStatus,
  validateStoryTransition,
} = require("../ui/server/services/project-scrum-transitions");
const { moveStoryToLane, upsertStory } = require("../ui/server/services/project-scrum-ops");

function scrumData(stories) {
  return {
    schemaVersion: 2,
    migrationHistory: [],
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [],
    stories,
    lanes: getCanonicalLanes(),
    lanesRevision: 0,
    transitionHistory: [],
  };
}

function withProject(data, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-transitions-"));
  const project = path.join(root, "project");
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "scrum.json"), JSON.stringify(data, null, 2), "utf8");
  try { return run({ root, project, file: path.join(project, "scrum.json") }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("matriz usa a ordem canonica mesmo quando a ordem visual muda", () => {
  const lanes = getCanonicalLanes().reverse().map((lane, order) => ({ ...lane, order }));
  assert.deepEqual(allowedTransitionLaneIds("em-desenvolvimento", lanes), {
    backward: "pronto-para-dev",
    forward: "em-revisao",
  });
  assert.equal(validateStoryTransition("em-desenvolvimento", "em-desenvolvimento", "em-revisao", lanes).toStatus, "review");
  assert.throws(
    () => validateStoryTransition("em-desenvolvimento", "em-desenvolvimento", "em-testes", lanes),
    /adjacentes/
  );
});

test("as doze raias projetam status legado compativel", () => {
  assert.deepEqual(getCanonicalLanes().map((lane) => laneToLegacyStatus(lane.id)), [
    "todo", "todo", "todo", "todo", "in_progress", "review",
    "review", "review", "review", "review", "review", "done",
  ]);
});

test("movimento adjacente persiste estado e historico atomicamente", () => withProject(scrumData([{
  id: "story-1", key: "TEST-1", title: "Historia", sprintId: "sprint-1",
  status: "todo", laneId: "pronto-para-dev", origin: "local",
}]), ({ project, file }) => {
  const result = moveStoryToLane(
    "test", project, project, "story-1", "pronto-para-dev", "em-desenvolvimento", "2026-10-19T15:00:00.000Z"
  );
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(stored.schemaVersion, 2);
  assert.equal(stored.stories[0].laneId, "em-desenvolvimento");
  assert.equal(stored.stories[0].status, "in_progress");
  assert.deepEqual(stored.transitionHistory[0], {
    id: "story-1:2026-10-19T15:00:00.000Z:em-desenvolvimento",
    storyId: "story-1", storyKey: "TEST-1",
    fromLaneId: "pronto-para-dev", toLaneId: "em-desenvolvimento",
    fromStatus: "todo", toStatus: "in_progress",
    occurredAt: "2026-10-19T15:00:00.000Z", storySource: "local",
  });
  assert.equal(result.scrum.storyTransitions["story-1"].forward, "em-revisao");
  moveStoryToLane(
    "test", project, project, "story-1", "em-desenvolvimento", "pronto-para-dev", "2026-10-19T15:01:00.000Z"
  );
  const returned = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(returned.stories[0].laneId, "pronto-para-dev");
  assert.equal(returned.stories[0].status, "todo");
  assert.equal(returned.transitionHistory.length, 2);
}));

test("rejeicoes e conflito nao alteram o arquivo", () => withProject(scrumData([{
  id: "story-1", key: "TEST-1", title: "Historia", sprintId: "sprint-1",
  status: "in_progress", laneId: "em-desenvolvimento", origin: "local",
}]), ({ project, file }) => {
  const original = fs.readFileSync(file, "utf8");
  assert.throws(() => moveStoryToLane("test", project, project, "story-1", "pronto-para-dev", "em-revisao"), (error) => {
    assert.equal(error.code, "SCRUM_STORY_CONFLICT");
    assert.equal(error.currentLaneId, "em-desenvolvimento");
    return true;
  });
  assert.throws(() => moveStoryToLane("test", project, project, "story-1", "em-desenvolvimento", "em-testes"), /adjacentes/);
  assert.throws(() => moveStoryToLane("test", project, project, "story-1", "em-desenvolvimento", "em-desenvolvimento"), /ja esta/);
  assert.throws(() => moveStoryToLane("test", project, project, "story-1", "em-desenvolvimento", "desconhecida"), /invalido/);
  assert.equal(fs.readFileSync(file, "utf8"), original);
}));

test("raia inativa bloqueia entrada e saida", () => {
  const lanes = getCanonicalLanes().map((lane) => lane.id === "em-revisao" ? { ...lane, active: false } : lane);
  assert.deepEqual(allowedTransitionLaneIds("em-desenvolvimento", lanes), { backward: "pronto-para-dev", forward: null });
  assert.throws(
    () => validateStoryTransition("em-desenvolvimento", "em-desenvolvimento", "em-revisao", lanes),
    /inativas/
  );
});

test("edicao generica nao contorna o comando auditavel de transicao", () => withProject(scrumData([{
  id: "story-1", key: "TEST-1", title: "Historia", sprintId: "sprint-1",
  status: "todo", laneId: "pronto-para-dev", origin: "local",
}]), ({ project, file }) => {
  const original = fs.readFileSync(file, "utf8");
  assert.throws(
    () => upsertStory("test", project, project, { id: "story-1", title: "Historia", status: "done" }),
    /comando de transicao/
  );
  assert.equal(fs.readFileSync(file, "utf8"), original);
}));

test("historia Jira grava somente estado local e preserva snapshot", () => withProject(scrumData([]), ({ root, project, file }) => {
  const docDir = path.join(root, "doc", "scrum");
  fs.mkdirSync(docDir, { recursive: true });
  const snapshotFile = path.join(docDir, "_jira-dis.json");
  const snapshot = JSON.stringify([{
    id: "100", key: "DIS-499", fields: {
      summary: "Historia Jira", issuetype: { name: "Historia" }, issuelinks: [],
      status: { id: "1", name: "Desenvolvimento", statusCategory: { key: "indeterminate" } },
    },
  }], null, 2);
  fs.writeFileSync(snapshotFile, snapshot, "utf8");
  moveStoryToLane("test", project, root, "DIS-499", "em-desenvolvimento", "em-revisao", "2026-10-19T16:00:00.000Z");
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(fs.readFileSync(snapshotFile, "utf8"), snapshot);
  assert.equal(stored.stories[0].sourceKey, "DIS-499");
  assert.equal(stored.stories[0].laneId, "em-revisao");
  assert.equal(stored.stories[0].title, undefined);
  assert.equal(stored.transitionHistory[0].storySource, "jira-snapshot");
}));

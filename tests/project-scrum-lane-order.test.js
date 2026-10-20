// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getCanonicalLanes, reorderLaneConfiguration } = require("../ui/server/services/project-scrum-lanes");
const { reorderLanes, updateLanes } = require("../ui/server/services/project-scrum-ops");

function storedScrum() {
  return {
    schemaVersion: 2, lanesRevision: 0, migrationHistory: [], activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }], epics: [],
    lanes: getCanonicalLanes(),
    stories: [{ id: "story-1", key: "TEST-1", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev" }],
  };
}

function temporaryScrum(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-lane-order-"));
  const file = path.join(directory, "scrum.json");
  try {
    fs.writeFileSync(file, JSON.stringify(storedScrum(), null, 2), "utf8");
    run({ directory, file });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("reordena somente por permutacao completa dos IDs canonicos", () => {
  const lanes = getCanonicalLanes();
  const reversedIds = lanes.map(({ id }) => id).reverse();
  const reordered = reorderLaneConfiguration(lanes, reversedIds);
  assert.deepEqual(reordered.map(({ id }) => id), reversedIds);
  assert.deepEqual(reordered.map(({ order }) => order), [...Array(12).keys()]);
  assert.throws(() => reorderLaneConfiguration(lanes, reversedIds.slice(1)), /exatamente 12/);
  assert.throws(() => reorderLaneConfiguration(lanes, reversedIds.map((id, index) => index ? id : reversedIds[1])), /duplicados/);
});

test("persiste ordem e revisao sem alterar historias ou status legados", () => temporaryScrum(({ directory, file }) => {
  const before = JSON.parse(fs.readFileSync(file, "utf8"));
  const laneIds = before.lanes.map(({ id }) => id);
  [laneIds[0], laneIds[1]] = [laneIds[1], laneIds[0]];
  const result = reorderLanes("temporario", directory, directory, laneIds, 0);
  const after = JSON.parse(fs.readFileSync(file, "utf8"));

  assert.deepEqual(after.lanes.map(({ id }) => id), laneIds);
  assert.equal(after.lanesRevision, 1);
  assert.equal(after.schemaVersion, 2);
  assert.deepEqual(after.stories, before.stories);
  assert.deepEqual(result.scrum.stories, before.stories);
}));

test("revisao obsoleta gera conflito e nao sobrescreve a ordem atual", () => temporaryScrum(({ directory, file }) => {
  const laneIds = getCanonicalLanes().map(({ id }) => id).reverse();
  reorderLanes("temporario", directory, directory, laneIds, 0);
  const persisted = fs.readFileSync(file, "utf8");

  assert.throws(
    () => reorderLanes("temporario", directory, directory, laneIds.reverse(), 0),
    (error) => error.code === "SCRUM_LANES_CONFLICT" && error.currentRevision === 1
  );
  assert.equal(fs.readFileSync(file, "utf8"), persisted);
}));

test("revisao e obrigatoria para qualquer mutacao das raias", () => temporaryScrum(({ directory }) => {
  const lanes = getCanonicalLanes();
  assert.throws(() => reorderLanes("temporario", directory, directory, lanes.map(({ id }) => id)), /Revisao/);
  assert.throws(() => updateLanes("temporario", directory, directory, lanes), /Revisao/);
}));

test("editar atributos depois da reordenacao preserva a ordem", () => temporaryScrum(({ directory, file }) => {
  const reversedIds = getCanonicalLanes().map(({ id }) => id).reverse();
  const reordered = reorderLanes("temporario", directory, directory, reversedIds, 0).scrum;
  const configured = reordered.lanes.map((lane) => lane.id === "discovery" ? { ...lane, name: "Descoberta" } : lane);
  updateLanes("temporario", directory, directory, configured, 1);
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));

  assert.deepEqual(stored.lanes.map(({ id }) => id), reversedIds);
  assert.equal(stored.lanes.find(({ id }) => id === "discovery").name, "Descoberta");
  assert.equal(stored.lanesRevision, 2);
}));

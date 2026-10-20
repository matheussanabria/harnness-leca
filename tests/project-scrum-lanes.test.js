// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  getCanonicalLanes,
  mergeLaneConfiguration,
  validateLaneConfiguration,
} = require("../ui/server/services/project-scrum-lanes");
const { updateLanes } = require("../ui/server/services/project-scrum-ops");

function scrumData() {
  return {
    schemaVersion: 2,
    migrationHistory: [],
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [],
    stories: [{ id: "story-1", key: "TEST-1", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev" }],
  };
}

test("catalogo canonico possui doze IDs estaveis e atributos configuraveis", () => {
  const lanes = getCanonicalLanes();
  assert.equal(lanes.length, 12);
  assert.equal(new Set(lanes.map(({ id }) => id)).size, 12);
  assert.deepEqual(lanes.map(({ order }) => order), [...Array(12).keys()]);
  assert.ok(lanes.some(({ id }) => id === "pronto-para-dev"));
  assert.ok(lanes.some(({ id }) => id === "em-desenvolvimento"));
  assert.ok(lanes.some(({ id }) => id === "em-revisao"));
  assert.ok(lanes.some(({ id }) => id === "concluido"));
});

test("merge preserva IDs e ordem canonicos sem aceitar criacao ou exclusao", () => {
  const merged = mergeLaneConfiguration([
    { id: "concluido", name: "Entregue", description: "Finalizado", color: "#123456", visible: false, active: false, order: 0 },
    { id: "inventada", name: "Outra", description: "", color: "#ffffff", visible: true, active: true },
  ]);
  assert.equal(merged.length, 12);
  assert.equal(merged[11].id, "concluido");
  assert.equal(merged[11].name, "Entregue");
  assert.equal(merged[11].order, 11);
  assert.equal(merged.some(({ id }) => id === "inventada"), false);
});

test("validacao rejeita IDs alterados, duplicados e campos invalidos", () => {
  const valid = getCanonicalLanes();
  assert.throws(() => validateLaneConfiguration(valid.slice(1)), /exatamente 12/);
  assert.throws(() => validateLaneConfiguration(valid.map((lane, index) => index === 0 ? { ...lane, id: valid[1].id } : lane)), /duplicados/);
  assert.throws(() => validateLaneConfiguration(valid.map((lane, index) => index === 0 ? { ...lane, color: "red" } : lane)), /Cor invalida/);
  assert.throws(() => validateLaneConfiguration(valid.map((lane, index) => index === 0 ? { ...lane, visible: "sim" } : lane)), /booleanas/);
});

test("persistencia por projeto mantem schema v2 e nao toca scrum real", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-lanes-"));
  const file = path.join(directory, "scrum.json");
  try {
    fs.writeFileSync(file, JSON.stringify(scrumData(), null, 2), "utf8");
    const lanes = getCanonicalLanes().map((lane) => lane.id === "discovery"
      ? { ...lane, name: "Descoberta", description: "Problema validado", color: "#112233", visible: false, active: false }
      : lane);
    const result = updateLanes("temporario", directory, directory, lanes, 0);
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));

    assert.equal(result.scrum.lanes.length, 12);
    assert.equal(stored.schemaVersion, 2);
    assert.equal(stored.lanes.find((lane) => lane.id === "discovery").name, "Descoberta");
    assert.equal(stored.lanes.find((lane) => lane.id === "discovery").visible, false);
    assert.equal(stored.stories[0].status, "todo");
    assert.equal(stored.stories[0].laneId, "pronto-para-dev");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

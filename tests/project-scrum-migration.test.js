// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SCRUM_SCHEMA_VERSION,
  backupPathFor,
  migrateScrumData,
  migrateScrumFile,
  rollbackScrumFile,
} = require("../ui/server/services/project-scrum-migration");
const {
  loadStoredProjectScrum,
} = require("../ui/server/services/project-scrum-persist");
const {
  updateStoryStatus,
} = require("../ui/server/services/project-scrum-ops");

function legacyData(statuses = ["todo", "in_progress", "review", "done"]) {
  return {
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [{ id: "epic-1", title: "Epic" }],
    stories: statuses.map((status, index) => ({
      id: `story-${index + 1}`,
      key: `TEST-${index + 1}`,
      sprintId: "sprint-1",
      status,
      points: index + 1,
    })),
  };
}

test("migra os quatro status sem remover o contrato legado", () => {
  const source = legacyData();
  const result = migrateScrumData(source, () => "2026-10-19T12:00:00.000Z");

  assert.equal(result.changed, true);
  assert.equal(result.data.schemaVersion, SCRUM_SCHEMA_VERSION);
  assert.deepEqual(result.data.stories.map(({ status }) => status), ["todo", "in_progress", "review", "done"]);
  assert.deepEqual(result.data.stories.map(({ laneId }) => laneId), [
    "pronto-para-dev", "em-desenvolvimento", "em-revisao", "concluido",
  ]);
  assert.equal(result.data.activeSprintId, source.activeSprintId);
  assert.deepEqual(result.data.stories.map(({ points }) => points), [1, 2, 3, 4]);
  assert.equal(result.data.migrationHistory[0].mappedStories, 4);
  assert.equal(source.schemaVersion, undefined);
});

test("preserva e audita status desconhecido sem remapear silenciosamente", () => {
  const result = migrateScrumData(legacyData(["aguardando_cliente"]), () => "2026-10-19T12:00:00.000Z");
  assert.equal(result.data.stories[0].status, "aguardando_cliente");
  assert.equal(result.data.stories[0].laneId, null);
  assert.deepEqual(result.data.migrationHistory[0].unmappedStatuses, ["aguardando_cliente"]);
});

test("migracao de arquivo cria backup unico, e segunda leitura e no-op", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-migration-"));
  const scrumFile = path.join(directory, "scrum.json");
  const original = JSON.stringify(legacyData(), null, 2);
  try {
    fs.writeFileSync(scrumFile, original, "utf8");
    const first = migrateScrumFile(scrumFile, JSON.parse(original), () => "2026-10-19T12:00:00.000Z");
    const migratedContent = fs.readFileSync(scrumFile, "utf8");
    const second = migrateScrumFile(scrumFile, JSON.parse(migratedContent));

    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assert.equal(fs.readFileSync(backupPathFor(scrumFile), "utf8"), original);
    assert.equal(fs.readFileSync(scrumFile, "utf8"), migratedContent);
    assert.deepEqual(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("rollback restaura exatamente o arquivo v1", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-rollback-"));
  const scrumFile = path.join(directory, "scrum.json");
  const original = JSON.stringify(legacyData(), null, 2) + "\n";
  try {
    fs.writeFileSync(scrumFile, original, "utf8");
    migrateScrumFile(scrumFile, JSON.parse(original));
    rollbackScrumFile(scrumFile);
    assert.equal(fs.readFileSync(scrumFile, "utf8"), original);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("persistencia migra ao ler e movimentacao mantem status e raia coerentes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-persist-"));
  const scrumFile = path.join(directory, "scrum.json");
  try {
    fs.writeFileSync(scrumFile, JSON.stringify(legacyData(["todo"]), null, 2), "utf8");
    const loaded = loadStoredProjectScrum("test", directory, directory);
    assert.equal(loaded.schemaVersion, SCRUM_SCHEMA_VERSION);
    assert.equal(loaded.stories[0].laneId, "pronto-para-dev");

    updateStoryStatus("test", directory, directory, "story-1", "in_progress");
    const stored = JSON.parse(fs.readFileSync(scrumFile, "utf8"));
    assert.equal(stored.stories[0].status, "in_progress");
    assert.equal(stored.stories[0].laneId, "em-desenvolvimento");
    assert.throws(
      () => updateStoryStatus("test", directory, directory, "story-1", "desconhecido"),
      /invalido/
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

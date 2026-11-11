import test from "node:test";
import assert from "node:assert/strict";
import { storiesForSprint } from "../ui/public/js/modules/design-scrum-filters.js";
import { renderStoryCard } from "../ui/public/js/modules/design-scrum-story-card.js";

const scrum = {
  activeSprintId: "s43",
  sprints: [
    { id: "s43", name: "Sprint 43", status: "active" },
    { id: "s42", name: "Sprint 42", status: "active" },
    { id: "s10", name: "Sprint 10", status: "completed" },
  ],
  stories: [
    { id: "a", key: "DIS-1", sprintId: "s43", laneId: "priorizado", status: "todo" },
    { id: "b", key: "DIS-443", sprintId: "s42", laneId: "pronto-para-dev", status: "todo" },
    { id: "c", key: "DIS-2", sprintId: "s42", laneId: "concluido", status: "done" },
    { id: "d", key: "DIS-3", sprintId: "s42", laneId: "backlog", status: "todo" },
    { id: "e", key: "DIS-4", sprintId: "s10", laneId: "em-desenvolvimento", status: "todo" },
    { id: "f", key: "DIS-5", sprintId: null, laneId: "em-desenvolvimento", status: "todo" },
  ],
};

test("CP-01: historia aberta de sprint anterior aparece na sprint ativa com o selo da origem", () => {
  const shown = storiesForSprint(scrum.stories, scrum, "active");
  const carried = shown.find((s) => s.key === "DIS-443");
  assert.ok(carried);
  assert.equal(carried.carryFrom, "Sprint 42");
});

test("CP-02: historia concluida ou do backlog de outra sprint nao entra", () => {
  const keys = storiesForSprint(scrum.stories, scrum, "active").map((s) => s.key);
  assert.ok(!keys.includes("DIS-2"));
  assert.ok(!keys.includes("DIS-3"));
});

test("CP-03: sprint encerrada ou historia sem sprint nao traz historias", () => {
  const keys = storiesForSprint(scrum.stories, scrum, "active").map((s) => s.key);
  assert.ok(!keys.includes("DIS-4"));
  assert.ok(!keys.includes("DIS-5"));
});

test("CP-04: escolher uma sprint especifica mostra so ela, sem selo", () => {
  const shown = storiesForSprint(scrum.stories, scrum, "s42");
  assert.deepEqual(shown.map((s) => s.key).sort(), ["DIS-2", "DIS-3", "DIS-443"]);
  assert.ok(shown.every((s) => !s.carryFrom));
});

test("CP-01: escolher a propria sprint ativa pelo id tambem traz a historia da sprint anterior", () => {
  const keys = storiesForSprint(scrum.stories, scrum, "s43").map((s) => s.key);
  assert.deepEqual(keys.sort(), ["DIS-1", "DIS-443"]);
});

test("CP-05: historia da propria sprint ativa nao ganha selo; a de outra sprint ganha", () => {
  const lanes = [{ id: "priorizado", name: "Priorizado" }];
  const own = renderStoryCard(storiesForSprint(scrum.stories, scrum, "active")[0], [], {}, lanes);
  assert.ok(!own.includes("story-card-carry"));
  const carried = renderStoryCard(storiesForSprint(scrum.stories, scrum, "active").find((s) => s.carryFrom), [], {}, lanes);
  assert.match(carried, /story-card-carry/);
  assert.match(carried, /veio da Sprint 42/);
});

test("sem sprint ativa nao ha historias trazidas", () => {
  const none = { ...scrum, activeSprintId: null };
  assert.equal(storiesForSprint(none.stories, none, "all").length, none.stories.length);
});

const lanesDef = [
  { id: "priorizado", name: "Priorizado", visible: true, active: true, color: "#fff", icon: "flag", description: "" },
  { id: "pronto-para-dev", name: "Pronto para desenvolvimento", visible: false, active: true, color: "#fff", icon: "flag", description: "" },
  { id: "pronto-para-testes", name: "Pronto para testes", visible: false, active: true, color: "#fff", icon: "flag", description: "" },
];

test("CP-07: raia oculta com historias aparece no quadro marcada como oculta", async () => {
  const { renderSprintKanban } = await import("../ui/public/js/modules/design-scrum-sprint.js");
  const html = renderSprintKanban({ ...scrum, lanes: lanesDef });
  assert.match(html, /data-lane-id="pronto-para-dev"/);
  assert.match(html, /Oculta/);
  assert.match(html, /DIS-443/);
});

test("CP-08: raia oculta sem historias continua escondida", async () => {
  const { renderSprintKanban } = await import("../ui/public/js/modules/design-scrum-sprint.js");
  const html = renderSprintKanban({ ...scrum, lanes: lanesDef });
  assert.ok(!html.includes('data-lane-id="pronto-para-testes"'));
});

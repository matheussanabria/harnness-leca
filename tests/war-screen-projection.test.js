// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  WAR_SCREEN_TABS,
  normalizeWarScreenPreset,
  getWarScreenTab,
  isScrumProjection
} from "../ui/public/js/office/war-screen-tabs-model.js";
import {
  activeSprintOf,
  storiesForProjection,
  buildScrumProjection
} from "../ui/public/js/office/war-screen-projection-model.js";
import { officeScreenPresets } from "../ui/public/js/office/office-screen-presets.js";

const ROOT = new URL("../", import.meta.url);
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

function read(relative) {
  return readFileSync(new URL(relative, ROOT), "utf8");
}

function lineCount(relative) {
  return read(relative).split(/\r?\n/).length;
}

function fixture() {
  return {
    activeSprintId: "sprint-1",
    sprints: [
      { id: "sprint-1", name: "Sprint Atual", goal: "Entregar o telão", status: "active" },
      { id: "sprint-2", name: "Próxima", status: "planned" }
    ],
    lanes: [
      { id: "concluido", name: "Concluído", color: "#22c55e", order: 1, visible: true },
      { id: "backlog", name: "Backlog", color: "#64748b", order: 0, visible: true },
      { id: "oculta", name: "Oculta", color: "#000000", order: 2, visible: false }
    ],
    stories: [
      { id: "s1", key: "HAR-1", title: "Projetar Kanban", sprintId: "sprint-1", laneId: "backlog", points: 3, impediment: { active: true } },
      { id: "s2", key: "HAR-2", title: "Aba ao lado do telão", sprintId: "sprint-1", laneId: "concluido", points: 5 },
      { id: "s3", key: "HAR-3", title: "Fora da sprint", sprintId: "sprint-2", laneId: "backlog", points: 8 }
    ]
  };
}

test("EP-05.06: abas mantêm o telão em orquestração até seleção explícita", () => {
  assert.deepEqual(WAR_SCREEN_TABS.map((tab) => tab.id), ["orchestration", "kanban"]);
  assert.equal(normalizeWarScreenPreset("kanban"), "kanban");
  assert.equal(normalizeWarScreenPreset("metrics"), "orchestration");
  assert.equal(getWarScreenTab("kanban").label, "Kanban Scrum");
  assert.equal(isScrumProjection("kanban"), true);
  assert.equal(isScrumProjection("orchestration"), false);

  officeScreenPresets.reset();
  assert.equal(officeScreenPresets.getPreset("war_room_main_panel"), "orchestration");
});

test("EP-05.06: projeção usa a sprint ativa, a ordem e a visibilidade das raias", () => {
  const scrum = fixture();
  assert.equal(activeSprintOf(scrum).id, "sprint-1");
  assert.deepEqual(storiesForProjection(scrum).map((story) => story.key), ["HAR-1", "HAR-2"]);

  const projection = buildScrumProjection(scrum, { maxCards: 1 });
  assert.equal(projection.sprintName, "Sprint Atual");
  assert.equal(projection.sprintGoal, "Entregar o telão");
  assert.deepEqual(projection.lanes.map((lane) => lane.id), ["backlog", "concluido"]);
  assert.equal(projection.lanes[0].storyCount, 1);
  assert.equal(projection.lanes[0].cards[0].blocked, true);
  assert.equal(projection.lanes[1].points, 5);
  assert.deepEqual(projection.metrics, {
    stories: 2,
    points: 8,
    doneStories: 1,
    donePoints: 5,
    blockedStories: 1,
    completion: 63
  });
});

test("EP-05.06: projeção vazia não quebra e mantém métricas zeradas", () => {
  const projection = buildScrumProjection({});
  assert.equal(projection.lanes.length, 0);
  assert.equal(projection.metrics.stories, 0);
  assert.equal(projection.metrics.points, 0);
  assert.equal(projection.metrics.completion, 0);
});

test("EP-05.06: telão renderiza Kanban e abas físicas sem substituir a orquestração", () => {
  const renderer = read("ui/public/js/office-war-screen.js");
  const tabs = read("ui/public/js/office3d/war-screen/war-screen-tabs.js");
  const corridor = read("ui/public/js/office3d/war-room-corridor.js");
  const pointer = read("ui/public/js/office3d/pointer-controller.js");
  const scrumData = read("ui/public/js/modules/design-scrum-data.js");

  assert.match(renderer, /renderScrumProjection/);
  assert.match(renderer, /scrumMode/);
  assert.match(renderer, /preset/);
  assert.match(tabs, /createWarScreenTabs/);
  assert.match(tabs, /officeScreenPresets\.setPreset\("war_room_main_panel"/);
  assert.match(tabs, /war_screen_tab_/);
  assert.match(corridor, /createWarScreenTabs/);
  assert.match(pointer, /interactById/);
  assert.match(scrumData, /dai:scrumChanged/);
});

test("EP-05.06: arquivos novos e alterados ficam abaixo de 300 linhas e sem emojis", () => {
  const files = [
    "ui/public/js/office/war-screen-tabs-model.js",
    "ui/public/js/office/war-screen-projection-model.js",
    "ui/public/js/office3d/war-screen/war-screen-tabs.js",
    "ui/public/js/office3d/war-screen/war-screen-scrum.js",
    "ui/public/js/office-war-screen.js",
    "ui/public/js/office3d/world-war-room.js",
    "ui/public/js/office3d/war-room-corridor.js",
    "ui/public/js/office3d/interaction-manager.js",
    "ui/public/js/office3d/pointer-controller.js",
    "ui/public/js/office-state.js",
    "ui/public/js/modules/design-scrum-data.js",
    "tests/war-screen-projection.test.js"
  ];

  for (const file of files) {
    const source = read(file);
    assert.ok(lineCount(file) <= 300, `${file} passou de 300 linhas`);
    assert.equal(EMOJI_REGEX.test(source), false, `${file} contém emoji`);
  }
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("ordem visivel preserva a posicao das raias ocultas", async () => {
  const { replaceVisibleLaneOrder } = await import("../ui/public/js/modules/design-scrum-lane-order-model.js");
  const lanes = [
    { id: "a", visible: true }, { id: "oculta", visible: false }, { id: "b", visible: true },
  ];
  assert.deepEqual(replaceVisibleLaneOrder(lanes, ["b", "a"]), ["b", "oculta", "a"]);
});

test("UI oferece drag e botoes acessiveis usando o mesmo endpoint versionado", () => {
  const sprint = read("ui/public/js/modules/design-scrum-sprint.js");
  const order = read("ui/public/js/modules/design-scrum-lane-order.js");
  const config = read("ui/public/js/modules/design-scrum-lane-config.js");
  const router = read("ui/server/routes/scrum.routes.js");
  const css = read("ui/public/css/design.css");

  assert.match(sprint, /draggable="true"/);
  assert.match(sprint, /Mover raia .* para a esquerda/);
  assert.match(sprint, /Mover raia .* para a direita/);
  assert.match(order, /scrum\/lanes\/order/);
  assert.match(order, /expectedRevision/);
  assert.match(order, /aria-live/);
  assert.match(order, /focusLaneHandle/);
  assert.match(config, /expectedRevision/);
  assert.match(router, /scrum\\\/lanes\\\/order/);
  assert.match(css, /11-scrum-lane-order\.css/);
});

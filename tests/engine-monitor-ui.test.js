// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderEngineActivityBadge } = require("../ui/public/js/modules/engine-activity-badge");
const { getActivityDisplay, mapLegacyOfficeState } = require("../ui/public/js/modules/engine-activity-model");

test("engine-activity-ui: mapeia estados legados do escritório sem perda", () => {
  assert.equal(mapLegacyOfficeState("thinking"), "pensando");
  assert.equal(mapLegacyOfficeState("streaming"), "executando");
  assert.equal(mapLegacyOfficeState("waiting_approval"), "aguardando_resposta");
  assert.equal(mapLegacyOfficeState("offline"), "inativo");
  assert.equal(mapLegacyOfficeState("idle"), "hibernando");
});

test("engine-activity-ui: renderEngineActivityBadge gera HTML acessível e ícones FontAwesome sem emojis", () => {
  const badge = renderEngineActivityBadge({
    engineId: "opencode",
    presenca: "online",
    atividade: "executando",
    detalhe: "porta 63186",
  });

  assert.ok(badge.includes("fa-solid fa-gear fa-spin"));
  assert.ok(badge.includes("Executando"));
  assert.ok(badge.includes('data-engine="opencode"'));

  // Proibição estrita de emojis
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(badge), false, "não deve conter emojis");
});

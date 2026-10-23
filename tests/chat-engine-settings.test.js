// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const { applyEngineSettings, cs, hydrateEngineSettings, saveEngineSettings } =
  await import("../ui/public/js/modules/chat-store.js");

test("Chat: motor, modelo e esforço salvos sobrevivem à hidratação", () => {
  applyEngineSettings({
    engineFilter: "opencode",
    engineSettings: { opencode: { model: "mistral", effort: "high" } },
  });
  assert.equal(cs.currentEngine, "opencode");
  assert.equal(cs.engineSettings.opencode.model, "mistral");
  assert.equal(cs.engineSettings.opencode.effort, "high");
});

test("Chat: hydrateEngineSettings lê o estado da tela e ignora cliente quebrado", async () => {
  const client = {
    loadScreen: async (id) => {
      assert.equal(id, "chats");
      return { engineFilter: "codex", engineSettings: { codex: { model: "gpt-5", effort: "max" } } };
    },
  };
  await hydrateEngineSettings({ client });
  assert.equal(cs.currentEngine, "codex");
  assert.equal(cs.engineSettings.codex.model, "gpt-5");
  assert.equal(cs.engineSettings.codex.effort, "max");
});

test("Chat: saveEngineSettings persiste a seleção atual sem perder os outros motores", async () => {
  const patches = [];
  const client = { patchScreen: async (id, patch) => { patches.push({ id, patch }); return patch; } };
  cs.currentEngine = "gemini";
  cs.engineSettings.gemini.model = "gemini-2.5-pro";
  cs.engineSettings.gemini.effort = "max";
  saveEngineSettings({ client });
  await Promise.resolve();
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, "chats");
  assert.equal(patches[0].patch.engineFilter, "gemini");
  assert.equal(patches[0].patch.engineSettings.gemini.model, "gemini-2.5-pro");
  assert.equal(patches[0].patch.engineSettings.gemini.effort, "max");
  assert.equal(patches[0].patch.engineSettings.opencode.model, "mistral", "Não perde a configuração dos outros motores");
});

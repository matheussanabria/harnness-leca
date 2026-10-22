// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

storage.set(
  "harness_chat_engine_settings",
  JSON.stringify({
    currentEngine: "opencode",
    engineSettings: { opencode: { model: "mistral", effort: "high" } },
  }),
);

const { cs, saveEngineSettings } = await import("../ui/public/js/modules/chat-store.js");

test("Chat: motor, modelo e esforço salvos sobrevivem à recarga", () => {
  assert.equal(cs.currentEngine, "opencode");
  assert.equal(cs.engineSettings.opencode.model, "mistral");
  assert.equal(cs.engineSettings.opencode.effort, "high");
});

test("Chat: saveEngineSettings persiste a seleção atual", () => {
  cs.currentEngine = "gemini";
  cs.engineSettings.gemini.model = "gemini-2.5-pro";
  cs.engineSettings.gemini.effort = "max";
  saveEngineSettings();
  const saved = JSON.parse(storage.get("harness_chat_engine_settings"));
  assert.equal(saved.currentEngine, "gemini");
  assert.equal(saved.engineSettings.gemini.model, "gemini-2.5-pro");
  assert.equal(saved.engineSettings.gemini.effort, "max");
  assert.equal(saved.engineSettings.opencode.model, "mistral", "Não perde a configuração dos outros motores");
});

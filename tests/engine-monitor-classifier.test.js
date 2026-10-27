// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyActivityEvent, isTestCommand } = require("../tools/lib/engine-monitor/activity-classifier");

test("activity-classifier: reconhece comandos de teste declarativos", () => {
  assert.equal(isTestCommand("npm test"), true);
  assert.equal(isTestCommand("npm run test"), true);
  assert.equal(isTestCommand("node --test tests/xyz.test.js"), true);
  assert.equal(isTestCommand("mvn test"), true);
  assert.equal(isTestCommand("pytest"), true);
  assert.equal(isTestCommand("git status"), false);
  assert.equal(isTestCommand("node index.js"), false);
});

test("activity-classifier: mapeia eventos para os estados canônicos", () => {
  assert.equal(classifyActivityEvent({ toolName: "view_file" }), "lendo");
  assert.equal(classifyActivityEvent({ toolName: "grep_search" }), "lendo");
  assert.equal(classifyActivityEvent({ toolName: "write_to_file" }), "executando");
  assert.equal(classifyActivityEvent({ command: "node --test tests/abc.test.js" }), "testando");
  assert.equal(classifyActivityEvent({ toolName: "ask_question" }), "aguardando_resposta");
  assert.equal(classifyActivityEvent({ isWaitingUser: true }), "aguardando_resposta");
  assert.equal(classifyActivityEvent({ isThinking: true }), "pensando");
  assert.equal(classifyActivityEvent({ isPlanning: true }), "planejando");
  assert.equal(classifyActivityEvent({ toolName: "atelier_plan" }), "planejando");
});

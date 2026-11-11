const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEngineModelTurn } = require("../ui/server/services/atelier-cli-engine-turn.service");

const SID = "11111111-2222-3333-4444-555555555555";

test("turno por motor de CLI: lê tags, guarda a sessão e usa só a última mensagem depois", async () => {
  const prompts = [];
  const impl = {
    stream: (req) => {
      prompts.push(req);
      req.onChunk({ type: "text", text: 'ok <tool name="atelier_complete">{"summary":"feito"}</tool>', sessionId: SID });
      req.onDone({ sessionId: SID, fullText: "" });
    },
  };
  const events = [];
  const turn = buildEngineModelTurn({ impl, engine: "claude", slug: "p", model: "opus", effort: "medium" });
  const r1 = await turn([{ role: "user", text: "faça" }], undefined, (e) => events.push(e));
  assert.equal(r1.toolCalls[0].name, "atelier_complete");
  assert.equal(prompts[0].readOnly, true);
  assert.equal(prompts[0].model, "opus");
  assert.deepEqual(events.filter((e) => e.type === "session"), [{ type: "session", sessionId: SID }]);

  await turn([{ role: "user", text: "faça" }, { role: "model", text: "x" }, { role: "tool", toolResults: [{ name: "a", result: "ok" }] }]);
  assert.equal(prompts[1].sessionId, SID);
  assert.ok(!prompts[1].prompt.includes("Usuário:"), "com sessão não reenvia o histórico");
});

test("motor sem sessão recebe o histórico em texto e erro do motor vira exceção", async () => {
  const seen = [];
  const impl = { stream: (req) => { seen.push(req.prompt); req.onChunk({ type: "text", text: "sem tags" }); req.onDone({}); } };
  const turn = buildEngineModelTurn({ impl, engine: "ollama", slug: "p" });
  await turn([{ role: "user", text: "a" }, { role: "model", text: "b" }, { role: "user", text: "c" }]);
  assert.match(seen[0], /Usuário:\na/);

  const bad = buildEngineModelTurn({ impl: { stream: (r) => r.onError(new Error("falhou")) }, engine: "codex", slug: "p" });
  await assert.rejects(() => bad([{ role: "user", text: "x" }]), /falhou/);
});

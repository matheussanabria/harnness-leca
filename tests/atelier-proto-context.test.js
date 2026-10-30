const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildProtoContext } = require("../ui/server/services/atelier-proto-context.service");
const { createAtelierAgentLoop } = require("../ui/server/services/atelier-agent-loop.service");

function makeProto() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-ctx-"));
  const dir = path.join(projectDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(dir, "screens"), { recursive: true });
  fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
  fs.writeFileSync(path.join(dir, "proto.json"), JSON.stringify({ screens: [{ id: "home" }] }));
  fs.writeFileSync(path.join(dir, "screens", "home.html"), `<div class="toolbar"></div><script>localStorage.getItem("inv:produtos")</script>`);
  fs.writeFileSync(path.join(dir, "screens", "produtos.html"), "<main></main>");
  fs.writeFileSync(path.join(dir, "styles", "proto.css"), ".chip{color:red}");
  return projectDir;
}

test("protótipo vazio não gera contexto", () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-ctx-"));
  fs.mkdirSync(path.join(projectDir, "design", "prototypes", "p1"), { recursive: true });
  assert.strictEqual(buildProtoContext({ projectDir, protoId: "p1" }), "");
});

test("contexto traz telas, CSS, chaves de storage e telas não registradas", () => {
  const out = buildProtoContext({ projectDir: makeProto(), protoId: "p1" });
  assert.match(out, /\.chip\{color:red\}/);
  assert.match(out, /inv:produtos/);
  assert.match(out, /produtos \(\d+ caracteres, NÃO registrada/);
  assert.match(out, /CONTINUAÇÃO/);
});

test("o loop envia o contexto ao modelo mas o evento mostra só o pedido", async () => {
  const seen = [];
  const events = [];
  const loop = createAtelierAgentLoop({
    projectDir: "x", protoId: "p1", getContext: () => "CTX",
    modelTurn: async (history) => { seen.push(history[0].text); return { text: "ok" }; },
  });
  await loop.run("faça X", { onEvent: (e) => events.push(e) });
  assert.match(seen[0], /^CTX[\s\S]*faça X$/);
  assert.strictEqual(events.find((e) => e.type === "user_prompt").text, "faça X");
});

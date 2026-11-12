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

test("tela citada no pedido vai inteira e primeiro, mesmo grande e depois de outras no alfabeto", () => {
  const projectDir = makeProto();
  const dir = path.join(projectDir, "design", "prototypes", "p1", "screens");
  for (const n of ["a1", "a2", "a3", "a4", "a5", "a6", "a7"]) fs.writeFileSync(path.join(dir, `${n}.html`), "x".repeat(7000));
  const big = `<main>${"y".repeat(35000)}</main><!--FIM-->`;
  fs.writeFileSync(path.join(dir, "nova-prescricao.html"), big);
  const plain = buildProtoContext({ projectDir, protoId: "p1" });
  assert.doesNotMatch(plain, /FIM-->/);
  const out = buildProtoContext({ projectDir, protoId: "p1", prompt: '<contexto-elemento arquivo="screens/nova-prescricao.html">' });
  assert.match(out, /FIM-->/);
  assert.ok(out.indexOf("screens/nova-prescricao.html") < out.indexOf("screens/a1.html"));
});

test("regras proíbem esconder elementos de forma fixa sem pedido do usuário", () => {
  const out = buildProtoContext({ projectDir: makeProto(), protoId: "p1" });
  assert.match(out, /NÃO esconda elementos de forma fixa/);
  assert.match(out, /botão do olho/);
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

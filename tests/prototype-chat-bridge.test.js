const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-chat-bridge.js")).href);

function stubFetch(files) {
  global.fetch = async () => ({ json: async () => ({ files }) });
}

test("wrapAtelierPrompt: sessão nova leva regras e código; retomada sem mudança leva só o pedido", async () => {
  const bridge = await load();
  stubFetch({ "screens/home.html": "<p>oi</p>", "styles/proto.css": "p{}" });
  bridge.setAtelierChatContext({ slug: "s", protoId: "p1", getScreen: () => "home", reload() {}, mcpServer: "" });
  bridge.resetAtelierPromptState();

  const first = await bridge.wrapAtelierPrompt("faça X", { resumed: false });
  assert.match(first, /Ateliê de Protótipos/);
  assert.match(first, /<p>oi<\/p>/);
  assert.match(first, /Pedido do usuário:\nfaça X$/);

  assert.equal(await bridge.wrapAtelierPrompt("e agora Y", { resumed: true }), "e agora Y");

  stubFetch({ "screens/home.html": "<p>mudou</p>", "styles/proto.css": "p{}" });
  const changed = await bridge.wrapAtelierPrompt("Z", { resumed: true });
  assert.doesNotMatch(changed, /Ateliê de Protótipos/);
  assert.match(changed, /mudou desde a última mensagem/);
  assert.match(changed, /<p>mudou<\/p>/);

  assert.equal(await bridge.wrapAtelierPrompt("W", { resumed: true }), "W");
});

test("wrapAtelierPrompt: outra tela, outro protótipo ou sessão não retomada reenviam tudo", async () => {
  const bridge = await load();
  stubFetch({ "screens/home.html": "<p>a</p>", "screens/b.html": "<p>b</p>", "styles/proto.css": "" });
  let screen = "home";
  let proto = "p1";
  bridge.setAtelierChatContext({ slug: "s", protoId: proto, getScreen: () => screen, reload() {} });
  bridge.resetAtelierPromptState();
  await bridge.wrapAtelierPrompt("1", { resumed: false });
  screen = "b";
  assert.match(await bridge.wrapAtelierPrompt("2", { resumed: true }), /<p>b<\/p>/);
  bridge.setAtelierChatContext({ slug: "s", protoId: "p2", getScreen: () => "home", reload() {} });
  assert.match(await bridge.wrapAtelierPrompt("3", { resumed: true }), /Ateliê de Protótipos/);
  assert.match(await bridge.wrapAtelierPrompt("4", { resumed: false }), /Ateliê de Protótipos/);
});

test("wrapAtelierPrompt: sem Ateliê ativo devolve o texto original", async () => {
  const bridge = await load();
  bridge.setAtelierChatContext(null);
  assert.equal(await bridge.wrapAtelierPrompt("oi"), "oi");
});

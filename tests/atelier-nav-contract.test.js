// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { NAV_RULES, navScreenLine } = require("../ui/server/services/atelier-nav-contract.service");
const { buildProtoContext } = require("../ui/server/services/atelier-proto-context.service");

const BRIDGE = path.join(__dirname, "..", "ui", "public", "js", "modules", "prototype-chat-bridge.js");

function makeProto() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-contract-"));
  const dir = path.join(projectDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(dir, "screens"), { recursive: true });
  fs.writeFileSync(path.join(dir, "screens", "home.html"), "<main>home</main>");
  fs.writeFileSync(path.join(dir, "screens", "produtos.html"), "<main>produtos</main>");
  return projectDir;
}

test("NAV_RULES ensina data-action goto e proibe href de arquivo", () => {
  assert.match(NAV_RULES, /data-action="goto:/);
  assert.match(NAV_RULES, /Never use href for files/);
  assert.match(NAV_RULES, /goto: inside href/);
});

test("navScreenLine lista os IDs sem alterar o argumento", () => {
  const ids = ["home", "produtos"];
  assert.equal(navScreenLine(ids), "Valid screen IDs: home, produtos.");
  assert.deepEqual(ids, ["home", "produtos"]);
  assert.equal(navScreenLine([]), "Valid screen IDs: none yet.");
});

test("buildProtoContext lista os IDs das telas em disco e inclui o contrato", () => {
  const out = buildProtoContext({ projectDir: makeProto(), protoId: "p1" });
  assert.match(out, /Valid screen IDs: home, produtos\./);
  assert.match(out, /data-action="goto:/);
});

test("buildProtoContext sem telas ainda nao lista IDs nem contrato", () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-contract-"));
  const dir = path.join(projectDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
  fs.writeFileSync(path.join(dir, "styles", "proto.css"), ".chip{color:red}");
  const out = buildProtoContext({ projectDir, protoId: "p1" });
  assert.match(out, /proto\.css/);
  assert.doesNotMatch(out, /Valid screen IDs/);
  assert.doesNotMatch(out, /data-action="goto:/);
});

test("RULES do chat inclui o contrato de navegacao", () => {
  const source = fs.readFileSync(BRIDGE, "utf8");
  assert.match(source, /data-action="goto:<screen-id>"/);
  assert.match(source, /goto: dentro do href/);
});

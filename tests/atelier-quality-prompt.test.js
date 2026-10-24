const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { loadQualityContext } = require("../ui/server/services/atelier-quality.service");

const mod = (name) => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", name)).href);
const DS = { index: "# Design System index\n- button | Button | default | classes: btn", tokensCss: ":root {\n  --primary-interactive: #9a4a22;\n}" };

test("parseQualityCommand recognises /directions and leaves other text alone", async () => {
  const { parseQualityCommand } = await mod("prototype-prompt-quality.js");
  assert.deepEqual(parseQualityCommand("/directions landing for a cafe"), { mode: "directions", text: "landing for a cafe" });
  assert.deepEqual(parseQualityCommand("/Directions   x"), { mode: "directions", text: "x" });
  assert.deepEqual(parseQualityCommand("build a landing"), { mode: "compose", text: "build a landing" });
  assert.deepEqual(parseQualityCommand("a /directions b"), { mode: "compose", text: "a /directions b" });
});

test("buildQualityRules keeps the file-block format the parser needs and embeds the Design System", async () => {
  const { buildQualityRules } = await mod("prototype-prompt-quality.js");
  const rules = buildQualityRules(DS);
  assert.match(rules, /<arquivo caminho="screens\/home\.html">/);
  assert.match(rules, /Allowed paths: screens\/<id>\.html, styles\/proto\.css, data\/\*\.json/);
  assert.match(rules, /button \| Button/);
  assert.match(rules, /--primary-interactive: #9a4a22;/);
  assert.match(rules, /data-action="goto:<screen-id>"/);
  assert.doesNotMatch(rules, /Mode: directions/);
  assert.match(buildQualityRules(DS, "directions"), /screens\/direction-a\.html and screens\/direction-b\.html/);
  assert.doesNotMatch(rules, /[\u{1F300}-\u{1FAFF}☀-➿]/u, "the prompt itself must not contain emojis");
});

test("loadQualityContext treats any non-enabled answer as off and never throws", async () => {
  const { loadQualityContext: load } = await mod("prototype-prompt-quality.js");
  const ok = async () => ({ json: async () => ({ enabled: true, ...DS }) });
  assert.equal((await load("s", ok)).enabled, true);
  assert.deepEqual(await load("s", async () => ({ json: async () => ({ files: {} }) })), { enabled: false, reason: "flag-off" });
  assert.deepEqual(await load("s", async () => ({ json: async () => ({ enabled: false, reason: "design-system-missing" }) })), { enabled: false, reason: "design-system-missing" });
  assert.deepEqual(await load("s", async () => { throw new Error("offline"); }), { enabled: false, reason: "unavailable" });
});

test("service: flag off, Design System missing, and enabled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aq-"));
  try {
    const design = path.join(dir, "projects", "p", "design");
    const projectDir = path.join(dir, "projects", "p");
    fs.mkdirSync(path.join(design, "ds"), { recursive: true });
    assert.deepEqual(loadQualityContext(projectDir), { enabled: false, reason: "flag-off" });

    fs.writeFileSync(path.join(design, "profile.json"), JSON.stringify({ schema: 1, atelier: { qualityPrompt: true } }));
    assert.deepEqual(loadQualityContext(projectDir), { enabled: false, reason: "design-system-missing" });

    fs.writeFileSync(path.join(design, "ds", "ds-index.md"), DS.index);
    fs.writeFileSync(path.join(design, "ds", "tokens.css"), DS.tokensCss);
    const on = loadQualityContext(projectDir);
    assert.equal(on.enabled, true);
    assert.equal(on.index, DS.index);

    fs.writeFileSync(path.join(design, "profile.json"), JSON.stringify({ schema: 1, atelier: { qualityPrompt: "yes" } }));
    assert.equal(loadQualityContext(projectDir).enabled, false, "only the boolean true enables it");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function stub(files, quality) {
  global.fetch = async (url) => ({ json: async () => (String(url).includes("quality-context") ? quality : { files }) });
}

test("bridge with the flag on: English rules and Design System on a fresh session", async () => {
  const bridge = await mod("prototype-chat-bridge.js");
  stub({ "screens/home.html": "<p>oi</p>", "styles/proto.css": "p{}" }, { enabled: true, ...DS });
  bridge.setAtelierChatContext({ slug: "s", protoId: "p1", getScreen: () => "home", reload() {} });
  bridge.resetAtelierPromptState();
  const first = await bridge.wrapAtelierPrompt("make a landing", { resumed: false });
  assert.match(first, /Harness Atelier prototyping tool/);
  assert.match(first, /button \| Button/);
  assert.match(first, /Prototype: p1 \(active screen: home\)/);
  assert.match(first, /<p>oi<\/p>/);
  assert.match(first, /User request:\nmake a landing$/);
  assert.doesNotMatch(first, /Ateliê de Protótipos|Pedido do usuário/);
});

test("bridge with the flag on: /directions works on a fresh and on a resumed session", async () => {
  const bridge = await mod("prototype-chat-bridge.js");
  stub({ "screens/home.html": "<p>a</p>", "styles/proto.css": "" }, { enabled: true, ...DS });
  bridge.setAtelierChatContext({ slug: "s", protoId: "p1", getScreen: () => "home", reload() {} });
  bridge.resetAtelierPromptState();
  const fresh = await bridge.wrapAtelierPrompt("/directions a cafe page", { resumed: false });
  assert.match(fresh, /Mode: directions/);
  assert.match(fresh, /User request:\na cafe page$/);
  const resumed = await bridge.wrapAtelierPrompt("/directions again", { resumed: true });
  assert.match(resumed, /^Mode: directions/);
  assert.match(resumed, /User request:\nagain$/);
  assert.equal(await bridge.wrapAtelierPrompt("plain follow-up", { resumed: true }), "plain follow-up");
});

test("bridge with the flag off: legacy prompt is unchanged and /directions is left as typed", async () => {
  const bridge = await mod("prototype-chat-bridge.js");
  stub({ "screens/home.html": "<p>oi</p>", "styles/proto.css": "p{}" }, { enabled: false, reason: "flag-off" });
  bridge.setAtelierChatContext({ slug: "s", protoId: "p1", getScreen: () => "home", reload() {} });
  bridge.resetAtelierPromptState();
  const first = await bridge.wrapAtelierPrompt("/directions x", { resumed: false });
  assert.match(first, /Ateliê de Protótipos/);
  assert.match(first, /Pedido do usuário:\n\/directions x$/);
  assert.equal(await bridge.wrapAtelierPrompt("/directions y", { resumed: true }), "/directions y");
});

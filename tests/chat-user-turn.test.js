// @ts-check
// Short bubble for "Executar etapa": the engine keeps getting the full prompt.
const path = require("path");
const { pathToFileURL } = require("url");
const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-user-turn.js")).href);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FULL = "Workflow feature-delivery - executar a etapa \"História\".\n\nContexto <b>longo</b>";

test("buildUserTurn keeps the full prompt aside only when a different short text is given", async () => {
  const { buildUserTurn } = await load();
  assert.deepEqual(buildUserTurn("oi"), { role: "user", text: "oi" });
  assert.deepEqual(buildUserTurn("oi", "oi"), { role: "user", text: "oi" });
  assert.deepEqual(buildUserTurn("   ", ""), { role: "user", text: "   " });
  assert.deepEqual(buildUserTurn(FULL, "Executar etapa: História"), { role: "user", text: "Executar etapa: História", fullPrompt: FULL });
});

test("engineText replays the full prompt to the engine, never the short bubble text", async () => {
  const { buildUserTurn, engineText } = await load();
  assert.equal(engineText(buildUserTurn(FULL, "Executar etapa: História")), FULL);
  assert.equal(engineText(buildUserTurn("oi")), "oi");
  assert.equal(engineText({}), "");
});

test("userBubbleHtml shows the short text and an escaped, collapsible full prompt", async () => {
  const { buildUserTurn, userBubbleHtml } = await load();
  const html = userBubbleHtml(buildUserTurn(FULL, "Executar etapa: História"), esc);
  assert.match(html, /Executar etapa: História/);
  assert.match(html, /<details class="chat-full-prompt">/);
  assert.match(html, /Ver prompt/);
  assert.match(html, /&lt;b&gt;longo&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>longo/);
  const plain = userBubbleHtml(buildUserTurn("oi\nlinha 2"), esc);
  assert.match(plain, /oi<br>linha 2/);
  assert.doesNotMatch(plain, /details/);
});

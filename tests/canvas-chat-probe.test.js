// @ts-check
// Canvas chat probe (P-109): the judge must tell good answers from broken ones with the app's real parsers.
const test = require("node:test");
const assert = require("node:assert/strict");
const { SCENARIOS } = require("../tools/lib/canvas-probe/scenarios");
const { loadBridgeEnv } = require("../tools/lib/canvas-probe/bridge-env");
const { judge } = require("../tools/lib/canvas-probe/judge");
const { buildPrompt } = require("../tools/lib/canvas-probe/prompts");
const { toMarkdown } = require("../tools/lib/canvas-probe/report");

const scenario = (id) => SCENARIOS.find((s) => s.id === id);
let env;
test.before(async () => { env = await loadBridgeEnv(); });

test("a well-formed mind-map answer passes", () => {
  const answer = 'Expandi o backend.\n<mindmap parent="selected">\n- API\n  - REST\n- Banco\n- Cache\n- Filas\n</mindmap>';
  const v = judge(env, scenario("mm-expand-selected"), answer);
  assert.equal(v.verdict, "PASS");
  assert.equal(v.details.nodes, 5);
});

test("missing block, wrong parent, too few nodes and over-deep outlines are flagged", () => {
  assert.deepEqual(judge(env, scenario("mm-expand-selected"), "Claro, aqui vai: API, Banco").codes, ["NO_BLOCK"]);
  assert.ok(judge(env, scenario("mm-expand-root"), '<mindmap parent="selected">\n- A\n- B\n- C\n- D\n</mindmap>').codes.includes("WRONG_PARENT"));
  assert.ok(judge(env, scenario("mm-expand-selected"), '<mindmap parent="selected">\n- A\n</mindmap>').codes.includes("TOO_FEW_NODES"));
  const deep = '<mindmap>\n- a\n  - b\n    - c\n      - d\n        - e\n- f\n- g\n- h\n- i\n- j\n</mindmap>';
  assert.ok(judge(env, scenario("mm-deep"), deep).codes.includes("note:OVER_PROMPT_DEPTH_LIMIT"));
});

test("asterisk bullets and bullets wrapped in a fence inside the block are both parsed", () => {
  const bullets = "* A\n* B\n* C\n* D";
  const star = judge(env, scenario("mm-expand-selected"), `<mindmap parent="selected">\n${bullets}\n</mindmap>`);
  assert.equal(star.verdict, "PASS");
  const fenced = judge(env, scenario("mm-expand-selected"), `<mindmap parent="selected">\n\`\`\`\n${bullets}\n\`\`\`\n</mindmap>`);
  assert.equal(fenced.verdict, "PASS");
});

test("chat-only scenarios fail when the model emits a block", () => {
  assert.equal(judge(env, scenario("mm-chat-only"), "Mapas são radiais.").verdict, "PASS");
  assert.deepEqual(judge(env, scenario("bd-chat-only"), '<board mode="append">\nflowchart TD\n A-->B\n</board>').codes, ["UNEXPECTED_BLOCK"]);
});

test("board answers: valid flowchart passes; unsupported type, wrong mode and edge-less flowchart fail", () => {
  const ok = '<board mode="replace">\nflowchart TD\n  A[Login] --> B{Senha ok?}\n  B -->|sim| C[Entrar]\n</board>';
  assert.equal(judge(env, scenario("bd-flow"), ok).verdict, "PASS");
  assert.deepEqual(judge(env, scenario("bd-flow"), '<board mode="replace">\npie title Orçamento\n "dev": 50\n</board>').codes, ["UNSUPPORTED_TYPE"]);
  assert.equal(judge(env, scenario("bd-flow"), ok.replace("replace", "append")).verdict, "PASS");
  assert.ok(judge(env, scenario("bd-sequence"), '<board mode="replace">\nsequenceDiagram\n  C->>A: x\n</board>').codes.includes("WRONG_MODE"));
  assert.ok(judge(env, scenario("bd-flow"), '<board mode="replace">\nflowchart TD\n  A[Login]\n</board>').codes.includes("NO_EDGES"));
});

test("a fenced Mermaid body is tolerated by the board normalizer", () => {
  const fenced = '<board mode="append">\n```mermaid\nsequenceDiagram\n  C->>A: pedido\n```\n</board>';
  assert.equal(judge(env, scenario("bd-sequence"), fenced).verdict, "PASS");
});

test("declining an unsupported chart without a block is accepted, not a failure", () => {
  const v = judge(env, scenario("bd-unsupported"), "Não consigo desenhar gráfico de pizza aqui.");
  assert.equal(v.verdict, "PASS");
});

test("prompts carry the rules once; the resumed scenario repeats the transcript without the rules", () => {
  const fresh = buildPrompt(env, scenario("mm-expand-selected"));
  assert.match(fresh, /Você está no canvas de Mapas Mentais/);
  const resumed = buildPrompt(env, scenario("mm-resumed"));
  assert.equal(resumed.match(/Você está no canvas de Mapas Mentais/g).length, 1);
  assert.match(resumed, /\[Usuário\]\nAgora adicione também Testes/);
});

test("report aggregates pass counts per model", () => {
  const md = toMarkdown([
    { model: "m1", scenario: "a", run: 1, verdict: "PASS", codes: [] },
    { model: "m1", scenario: "b", run: 1, verdict: "FAIL", codes: ["NO_BLOCK"] },
  ]);
  assert.match(md, /\| b \| 0\/1 NO_BLOCK \|/);
  assert.match(md, /m1: 1\/2 \(50%\)/);
});

// EP-21.03: error messages with the source line, the line mapping and the 64 KB limit (pure, node:test).
// The Mermaid error shapes and line numbers below were measured on mermaid 11.17.2 in Chrome; the same cases run
// against the real library in tests/diagram-browser.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (name) => import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/diagram", name)).href);
const NL = "\n";
const join = (...lines) => lines.join(NL);

/** An error shaped like the ones mermaid.parse throws. */
const parseError = (message, hash) => Object.assign(new Error(message), hash ? { hash } : {});

test("CP-04: a syntax error gives the source line, the token, the fragment and what was expected", async () => {
  const { describeParseError } = await load("errors.ts");
  const source = join("flowchart TD", " A[Inicio] --> ", " B --x-- ?? C");
  const error = parseError(
    "Parse error on line 3:\n...[Inicio] -->  B --x-- ?? C\n----------------------^\nExpecting 'AMP', 'COLON', 'PIPE', 'TESTSTR', 'DOWN', 'DEFAULT', 'NUM', 'COMMA', 'NODE_STRING', 'BRKT', 'MINUS', 'MULT', 'UNICODE_TEXT', got 'START_LINK'",
    { text: "-- ", token: "START_LINK", line: 2 },
  );
  assert.deepEqual(describeParseError(error, source), {
    line: 3,
    message: 'Linha 3: trecho inesperado (START_LINK) perto de "[Inicio] -->  B --x-- ?? C". Esperado: AMP, COLON, PIPE, TESTSTR (+9).',
  });
});

test("describeParseError: end of line, a long fragment, no Expecting list, and the hash alone", async () => {
  const { describeParseError } = await load("errors.ts");
  const seq = join("sequenceDiagram", " A->>B oi ???");
  assert.deepEqual(
    describeParseError(parseError("Parse error on line 2:\n...iagram A->>B oi ???\n----------------------^\nExpecting 'TXT', got 'NEWLINE'", { token: "NEWLINE", line: 1 }), seq),
    { line: 2, message: 'Linha 2: fim da linha inesperado perto de "iagram A->>B oi ???". Esperado: TXT.' },
  );
  const long = `...${"x".repeat(100)}`;
  const longResult = describeParseError(parseError(`Parse error on line 1:\n${long}\n---^\nExpecting 'A', got 'B'`), "x");
  assert.ok(longResult.message.includes(`"...${"x".repeat(60)}"`), longResult.message);
  assert.equal(describeParseError(parseError("Parse error on line 1:\nabc\n--^\ngot 'Z'"), "abc").message, 'Linha 1: trecho inesperado (Z) perto de "abc".');
  assert.equal(describeParseError(parseError("boom", { line: 4, token: "TOK" }), "a").line, 5, "hash.line is zero based");
});

test("describeParseError: unknown diagram and failures that are not syntax errors never leak a stack", async () => {
  const { describeParseError } = await load("errors.ts");
  const unknown = Object.assign(new Error("No diagram type detected matching given configuration for text: foo"), { name: "UnknownDiagramError" });
  assert.match(describeParseError(unknown, "foo").message, /^Tipo de diagrama não reconhecido\. Comece o texto com: flowchart, sequenceDiagram/);
  const other = describeParseError(new TypeError("DOMPurify.addHook is not a function\n    at x (file.js:1)"), "flowchart TD");
  assert.equal(other.line, undefined);
  assert.equal(other.message, "Não foi possível validar o diagrama agora: DOMPurify.addHook is not a function.");
  assert.equal(describeParseError("texto solto", "a").message, "Não foi possível validar o diagrama agora: texto solto.");
  assert.equal(describeParseError(undefined, "a").message, "Não foi possível validar o diagrama agora: erro desconhecido.");
});

// Reported line (Mermaid, after its cleanup) -> line of the text the user typed. Each row is a measured result.
const LINE_CASES = [
  ["plain", join("flowchart TD", " A --> B", " B --x-- ?? C"), 3, 3],
  ["front matter", join("---", "title: T", "---", "flowchart TD", " A --> B", " B --x-- ?? C"), 3, 6],
  ["front matter with --- inside a value", join("---", 'title: "a --- b"', "---", "flowchart TD", " A --> B", " B --x-- ?? C"), 3, 6],
  ["leading comments", join("%% c1", "%% c2", "flowchart TD", " A --> B", " B --x-- ?? C"), 3, 5],
  ["interior comments", join("flowchart TD", " A --> B", " %% mid", " %% mid2", " B --x-- ?? C"), 3, 5],
  ["init directive", join('%%{init: {"theme":"dark"}}%%', "flowchart TD", " A --> B", " B --x-- ?? C"), 3, 4],
  ["leading blank lines", join("", "", "flowchart TD", " A --> B", " B --x-- ?? C"), 3, 5],
  ["CRLF", "flowchart TD\r\n A --> B\r\n B --x-- ?? C", 3, 3],
  ["interior blank lines count", join("flowchart TD", "", " A --> B", "", " B --x-- ?? C"), 5, 5],
  ["comment eats the blank lines before it", join("flowchart TD", " A --> B", "", " %% note", "", " C --> D", " B --x-- ?? C"), 5, 7],
  ["whitespace-only line counts", join("flowchart TD", " A --> B", "   ", " B --x-- ?? C"), 4, 4],
  ["trailing %% joins the next line (reports the line with the comment)", join("flowchart TD", " A --> B %% trailing", " B --x-- ?? C"), 2, 2],
];

test("CP-04: toSourceLine maps the line Mermaid reports back to the line the user typed", async () => {
  const { toSourceLine } = await load("lineMap.ts");
  for (const [name, source, reported, expected] of LINE_CASES) assert.equal(toSourceLine(source, reported), expected, name);
  assert.equal(toSourceLine("flowchart TD", 9), 9, "a line past the end keeps the reported number");
});

test("cleanedLineGroups: the trailing %% case groups two source lines under one cleaned line", async () => {
  const { cleanedLineGroups } = await load("lineMap.ts");
  assert.deepEqual(cleanedLineGroups(join("flowchart TD", " A --> B %% trailing", " B --> C", " C --> D")), [[1], [2, 3], [4]]);
  assert.deepEqual(cleanedLineGroups(join("flowchart TD", " A --> B")), [[1], [2]]);
  assert.deepEqual(cleanedLineGroups(""), []);
});

test("CP-05: the 64 KB limit is checked before Mermaid is even loaded", async () => {
  const { createValidator } = await load("validate.ts");
  const { MAX_SOURCE_BYTES } = await load("types.ts");
  let loads = 0;
  const parsed = [];
  const fake = {
    initialize() {},
    async parse(text) { parsed.push(text.length); return { diagramType: "flowchart-v2" }; },
    async render() { return { svg: "<svg/>" }; },
  };
  const validate = createValidator(async () => { loads += 1; return fake; });
  const header = "flowchart TD\n";
  const atLimit = header + "A".repeat(MAX_SOURCE_BYTES - header.length);
  assert.equal(new TextEncoder().encode(atLimit).length, MAX_SOURCE_BYTES);
  assert.deepEqual(await validate(atLimit), { ok: true, type: "flowchart-v2" }, "exactly 64 KB is accepted");
  assert.equal(loads, 1);

  const over = await validate(`${atLimit}A`);
  assert.equal(over.ok, false);
  assert.equal(over.message, "O diagrama passa do limite de 64 KB (tem 65 KB).");
  assert.equal(loads, 1, "an oversized source never reaches Mermaid");

  const multibyte = header + "é".repeat(MAX_SOURCE_BYTES / 2);
  assert.equal((await validate(multibyte)).ok, false, "the limit counts bytes, not characters");
});

test("validate: empty, refused and unknown headers answer without parsing; the parser's type wins", async () => {
  const { createValidator } = await load("validate.ts");
  let parses = 0;
  const make = (diagramType) => ({ initialize() {}, async parse() { parses += 1; return { diagramType }; }, async render() { return { svg: "" }; } });
  const validate = createValidator(async () => make("flowchart-v2"));
  assert.deepEqual(await validate("   "), { ok: false, message: "O diagrama está vazio." });
  assert.match((await validate("mindmap\n root")).message, /^Mapa mental em Mermaid não é aceito aqui/);
  assert.match((await validate("pie\n \"a\" : 1")).message, /^O tipo "pie" não é aceito neste editor/);
  assert.match((await validate("foo bar")).message, /^Tipo de diagrama não reconhecido/);
  assert.equal(parses, 0);
  const elk = createValidator(async () => make("flowchart-elk"));
  assert.match((await elk("flowchart TD\n A-->B")).message, /^O tipo "flowchart-elk" não é aceito/, "the parser reported an unsupported type");
});

test("validate: a library that fails to load or throws a syntax error becomes a message, never an exception", async () => {
  const { createValidator } = await load("validate.ts");
  const broken = createValidator(async () => { throw new Error("Failed to fetch dynamically imported module"); });
  const loadFailure = await broken("flowchart TD\n A-->B");
  assert.equal(loadFailure.ok, false);
  assert.match(loadFailure.message, /^Não foi possível validar o diagrama agora: Failed to fetch/);

  const syntax = createValidator(async () => ({
    initialize() {},
    async parse() { throw parseError("Parse error on line 3:\nB --x-- ?? C\n---^\nExpecting 'A', got 'B'", { line: 2 }); },
    async render() { return { svg: "" }; },
  }));
  const result = await syntax(join("---", "title: T", "---", "flowchart TD", " A --> B", " B --x-- ?? C"));
  assert.equal(result.ok, false);
  assert.equal(result.line, 6, "the line is the one in the user's text, front matter included");
});

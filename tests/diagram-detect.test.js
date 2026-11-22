// EP-21.03: diagram type detection from the header line (pure, node:test).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (name) => import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/diagram", name)).href);

test("CP-01: detectType: the six supported types by their header", async () => {
  const { detectType } = await load("detect.ts");
  const cases = [
    ["flowchart TD\n A-->B", "flowchart-v2"],
    ["graph LR\n A-->B", "flowchart-v2"],
    ["sequenceDiagram\n A->>B: oi", "sequence"],
    ["classDiagram\n A <|-- B", "classDiagram"],
    ["classDiagram-v2\n A <|-- B", "classDiagram"],
    ["stateDiagram-v2\n [*] --> A", "stateDiagram"],
    ["stateDiagram\n [*] --> A", "stateDiagram"],
    ["erDiagram\n A ||--o{ B : has", "er"],
    ["gantt\n title t", "gantt"],
  ];
  for (const [source, type] of cases) assert.deepEqual(detectType(source), { kind: "supported", type }, source);
});

test("CP-02: detectType: front matter, blank lines, %% comments and directives before the header are skipped", async () => {
  const { detectType, headerLine } = await load("detect.ts");
  const withFrontMatter = "---\ntitle: Pedido\nconfig:\n  theme: dark\n---\nflowchart LR\n A-->B";
  assert.deepEqual(detectType(withFrontMatter), { kind: "supported", type: "flowchart-v2" });
  assert.equal(headerLine("\n\n%% nota\n%%{init: {\"theme\":\"dark\"}}%%\nsequenceDiagram\n A->>B: x"), "sequenceDiagram");
  assert.deepEqual(detectType("---\ntitle: a --- b\n---\nerDiagram\n A ||--o{ B : x"), { kind: "supported", type: "er" });
  assert.deepEqual(detectType("\r\n%% c\r\ngantt\r\n title t"), { kind: "supported", type: "gantt" });
});

test("CP-03: detectType: mindmap is refused on purpose, other Mermaid families are refused as unsupported", async () => {
  const { detectType } = await load("detect.ts");
  assert.deepEqual(detectType("mindmap\n root\n  a"), { kind: "refused", reason: "mindmap", header: "mindmap" });
  for (const header of ["pie title X", "journey", "gitGraph", "timeline", "quadrantChart", "C4Context", "flowchart-elk TD", "xychart-beta"]) {
    const result = detectType(`${header}\n x`);
    assert.equal(result.kind, "refused", header);
    assert.equal(result.reason, "unsupported", header);
  }
});

test("detectType: text that is not a diagram header is unknown; keyword case matters like in Mermaid", async () => {
  const { detectType } = await load("detect.ts");
  for (const source of ["", "   \n\n", "foo bar\n baz", "Flowchart TD\n A-->B", "sequencediagram\n A->>B: x", "flowcharts TD", "A --> B"]) {
    assert.deepEqual(detectType(source), { kind: "unknown" }, JSON.stringify(source));
  }
  assert.deepEqual(detectType("---\ntitle: sem fim\nflowchart TD\n A-->B"), { kind: "unknown" }, "front matter never closed");
});

test("isSupported follows the ADR-014 list and the labels cover every supported type", async () => {
  const { isSupported, SUPPORTED_LABELS } = await load("detect.ts");
  const { SUPPORTED_TYPES } = await load("types.ts");
  for (const type of SUPPORTED_TYPES) {
    assert.equal(isSupported(type), true, type);
    assert.ok(SUPPORTED_LABELS[type], type);
  }
  for (const type of ["pie", "mindmap", "flowchart-elk", "class", ""]) assert.equal(isSupported(type), false, type);
});

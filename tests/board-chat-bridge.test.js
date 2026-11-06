const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (name) =>
  import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/board", name)).href);

// --- boardStatePayload tests ---

test("boardStatePayload: empty board text", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const result = boardStatePayload("b1", "Empty Board", []);
  assert.equal(result.outline, "(quadro vazio)");
  assert.equal(result.selectedId, "");
  assert.equal(result.selectedText, "");
});

test("boardStatePayload: counts by type", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const elements = [
    { id: "1", type: "rectangle", isDeleted: false, x: 0, y: 0, width: 100, height: 50 },
    { id: "2", type: "ellipse", isDeleted: false, x: 10, y: 10, width: 80, height: 40 },
    { id: "3", type: "diamond", isDeleted: false, x: 20, y: 20, width: 60, height: 30 },
    { id: "4", type: "arrow", isDeleted: false, x: 0, y: 0, width: 0, height: 0 },
    { id: "5", type: "line", isDeleted: false, x: 0, y: 0, width: 0, height: 0 },
    { id: "6", type: "image", isDeleted: false, fileId: "img1" },
    { id: "7", type: "text", isDeleted: false, text: "Hello" },
  ];
  const result = boardStatePayload("b1", "Test", elements);
  assert.ok(result.outline.includes("3 formas"));
  assert.ok(result.outline.includes("2 setas/linhas"));
  assert.ok(result.outline.includes("1 imagens"));
});

test("boardStatePayload: deleted elements ignored", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const elements = [
    { id: "1", type: "rectangle", isDeleted: true, x: 0, y: 0, width: 100, height: 50 },
    { id: "2", type: "rectangle", isDeleted: false, x: 10, y: 10, width: 80, height: 40 },
    { id: "3", type: "text", isDeleted: true, text: "Deleted text" },
    { id: "4", type: "text", isDeleted: false, text: "Live text" },
  ];
  const result = boardStatePayload("b1", "Test", elements);
  assert.ok(result.outline.includes("1 formas"));
  assert.ok(result.outline.includes("0 setas/linhas"));
  assert.ok(result.outline.includes("0 imagens"));
  assert.ok(result.outline.includes("- Live text"));
  assert.ok(!result.outline.includes("Deleted text"));
});

test("boardStatePayload: reading order (sort by y then x)", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const elements = [
    { id: "1", type: "text", text: "z-last", x: 100, y: 100 },
    { id: "2", type: "text", text: "a-first", x: 10, y: 10 },
    { id: "3", type: "text", text: "m-middle", x: 50, y: 10 },
  ];
  const result = boardStatePayload("b1", "Test", elements);
  const lines = result.outline.split("\n");
  assert.equal(lines[1], "- a-first");
  assert.equal(lines[2], "- m-middle");
  assert.equal(lines[3], "- z-last");
});

test("boardStatePayload: text cap at 120 chars", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const longText = "x".repeat(200);
  const elements = [{ id: "1", type: "text", text: longText }];
  const result = boardStatePayload("b1", "Test", elements);
  const textLine = result.outline.split("\n")[1];
  // The line is "- " plus the text; the TEXT is capped at 120 characters.
  assert.equal(textLine.length, 122);
  assert.equal(textLine.slice(2).length, 120);
  assert.ok(textLine.endsWith("..."));
});

test("boardStatePayload: 60-line cap with ... (mais N textos)", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const elements = [];
  for (let i = 0; i < 70; i++) {
    elements.push({ id: String(i), type: "text", text: `text${i}`, x: 10 * i, y: 10 * i });
  }
  const result = boardStatePayload("b1", "Test", elements);
  const lines = result.outline.split("\n");
  // Header + 60 text lines + "...mais" line = 62 lines
  assert.equal(lines.length, 62);
  assert.ok(lines[61].includes("... (mais 10 textos)"));
});

test("boardStatePayload: 300-element board stays bounded", async () => {
  const { boardStatePayload } = await load("chatBridge.ts");
  const elements = [];
  for (let i = 0; i < 300; i++) {
    if (i % 5 === 0) elements.push({ id: String(i), type: "rectangle", x: i, y: i, width: 10, height: 10 });
    else if (i % 5 === 1) elements.push({ id: String(i), type: "text", text: `t${i}`, x: i, y: i });
    else if (i % 5 === 2) elements.push({ id: String(i), type: "arrow", x: i, y: i, width: 10, height: 0 });
    else if (i % 5 === 3) elements.push({ id: String(i), type: "image", fileId: `f${i}` });
    else elements.push({ id: String(i), type: "ellipse", x: i, y: i, width: 10, height: 10 });
  }
  const result = boardStatePayload("b1", "Test", elements);
  const lines = result.outline.split("\n");
  // Header + 60 text lines + "...mais" line = 62 lines max
  assert.ok(lines.length <= 62);
});

// --- normalizeBoardBlock tests ---

test("normalizeBoardBlock: plain mermaid", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ mode: "append", body: "flowchart TD\n  A --> B" });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "append");
  assert.equal(result.source, "flowchart TD\n  A --> B");
});

test("normalizeBoardBlock: fenced ```mermaid```", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "```mermaid\nflowchart TD\n  A --> B\n```" });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "append");
  assert.equal(result.source, "flowchart TD\n  A --> B");
});

test("normalizeBoardBlock: CRLF normalization", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "graph LR\r\nA --> B\r\nC --> D" });
  assert.equal(result.ok, true);
  assert.ok(!result.source.includes("\r"));
});

test("normalizeBoardBlock: uppercase fence", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "```MERMAID\nsequenceDiagram\n  A->>B: Hi\n```" });
  assert.equal(result.ok, true);
  assert.equal(result.source, "sequenceDiagram\n  A->>B: Hi");
});

test("normalizeBoardBlock: %% comment before the header", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "%% comment\nflowchart TD\n  A --> B" });
  assert.equal(result.ok, true);
  // The comment is valid Mermaid and stays in the source; only the header detection skips it.
  assert.ok(result.source.includes("flowchart TD"));
});

test("normalizeBoardBlock: flowchart header", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "flowchart TD\n  A --> B" });
  assert.equal(result.ok, true);
});

test("normalizeBoardBlock: graph header", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "graph TD\n  A --> B" });
  assert.equal(result.ok, true);
});

test("normalizeBoardBlock: sequenceDiagram header", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "sequenceDiagram\n  A->>B: Hi" });
  assert.equal(result.ok, true);
});

test("normalizeBoardBlock: classDiagram header", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "classDiagram\n  Class <|-- Person" });
  assert.equal(result.ok, true);
});

test("normalizeBoardBlock: unsupported pie", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "pie title Test\n  A: 10" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported diagram type");
});

test("normalizeBoardBlock: unsupported gantt", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "gantt\n  title Test" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported diagram type");
});

test("normalizeBoardBlock: unsupported erDiagram", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "erDiagram\n  USER ||--o{ ORDER" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported diagram type");
});

test("normalizeBoardBlock: empty body", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty diagram");
});

test("normalizeBoardBlock: wrong shape (null)", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  assert.equal(normalizeBoardBlock(null).ok, false);
  assert.equal(normalizeBoardBlock(null).reason, "invalid block");
});

test("normalizeBoardBlock: wrong shape (undefined)", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  assert.equal(normalizeBoardBlock(undefined).ok, false);
});

test("normalizeBoardBlock: wrong shape (string)", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  assert.equal(normalizeBoardBlock("string").ok, false);
});

test("normalizeBoardBlock: wrong shape (array)", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  assert.equal(normalizeBoardBlock([]).ok, false);
});

test("normalizeBoardBlock: mode default is append", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ body: "flowchart TD\n  A --> B" });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "append");
});

test("normalizeBoardBlock: replace mode", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const result = normalizeBoardBlock({ mode: "replace", body: "graph TD\n  A --> B" });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "replace");
});

test("normalizeBoardBlock: 20000 cap", async () => {
  const { normalizeBoardBlock } = await load("chatBridge.ts");
  const longBody = "flowchart TD\n  A --> B\n".repeat(5000);
  const result = normalizeBoardBlock({ body: longBody });
  assert.equal(result.ok, true);
  assert.ok(result.source.length <= 20000);
});

// --- placeBelow tests ---

test("placeBelow: shifts below and left-aligns", async () => {
  const { placeBelow } = await load("chatBridge.ts");
  const existing = [
    { id: "1", type: "rectangle", x: 100, y: 50, width: 80, height: 40, isDeleted: false },
    { id: "2", type: "rectangle", x: 200, y: 80, width: 60, height: 30, isDeleted: false },
  ];
  const added = [
    { id: "a", type: "rectangle", x: 50, y: 10, width: 50, height: 20 },
    { id: "b", type: "rectangle", x: 150, y: 30, width: 40, height: 20 },
  ];
  const result = placeBelow(existing, added, 60);

  // Existing: bottom=110 (from element 2), left=100
  // Added: top=10, left=50
  // shiftX = 100 - 50 = 50
  // shiftY = 110 + 60 - 10 = 160
  assert.equal(result[0].x, 100);
  assert.equal(result[0].y, 170);
  assert.equal(result[1].x, 200);
  assert.equal(result[1].y, 190);
});

test("placeBelow: empty existing returns unshifted copies", async () => {
  const { placeBelow } = await load("chatBridge.ts");
  const existing = [];
  const added = [{ id: "a", type: "rectangle", x: 50, y: 100, width: 80, height: 40 }];
  const result = placeBelow(existing, added);
  assert.equal(result[0].x, 50);
  assert.equal(result[0].y, 100);
});

test("placeBelow: deleted existing ignored", async () => {
  const { placeBelow } = await load("chatBridge.ts");
  const existing = [
    { id: "1", type: "rectangle", x: 100, y: 50, width: 80, height: 40, isDeleted: true },
    { id: "2", type: "rectangle", x: 200, y: 80, width: 60, height: 30, isDeleted: false },
  ];
  const added = [{ id: "a", type: "rectangle", x: 50, y: 10, width: 50, height: 20 }];
  const result = placeBelow(existing, added, 60);

  // Only element 2 is live: bottom=110, left=200
  // shiftX = 200 - 50 = 150
  // shiftY = 110 + 60 - 10 = 160
  assert.equal(result[0].x, 200);
  assert.equal(result[0].y, 170);
});

test("placeBelow: elements without numbers ignored", async () => {
  const { placeBelow } = await load("chatBridge.ts");
  const existing = [{ id: "1", type: "text", isDeleted: false }];
  const added = [{ id: "a", type: "rectangle", x: 50, y: 10, width: 50, height: 20 }];
  const result = placeBelow(existing, added);
  // No valid existing elements -> returns unshifted copies
  assert.equal(result[0].x, 50);
  assert.equal(result[0].y, 10);
});

test("placeBelow: copies not mutated", async () => {
  const { placeBelow } = await load("chatBridge.ts");
  const existing = [{ id: "1", type: "rectangle", x: 100, y: 50, width: 80, height: 40, isDeleted: false }];
  const added = [{ id: "a", type: "rectangle", x: 50, y: 10, width: 50, height: 20 }];
  const originalX = added[0].x;
  const originalY = added[0].y;
  const result = placeBelow(existing, added);

  // Original unchanged
  assert.equal(added[0].x, originalX);
  assert.equal(added[0].y, originalY);

  // Result is different
  assert.notEqual(result[0].x, originalX);
  assert.notEqual(result[0].y, originalY);
});
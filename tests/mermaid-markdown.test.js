// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Mock de DOM minimo se necessario para imports
if (typeof global.window === "undefined") {
  // @ts-ignore
  global.window = {};
}

const { md } = require("../ui/public/js/shared/markdown.js");
const { renderMermaidCard } = require("../ui/public/js/shared/markdown-code.js");

test("markdown: renders mermaid block inside a dedicated diagram card", () => {
  const source = [
    "# Titulo",
    "",
    "```mermaid",
    "stateDiagram-v2",
    "    [*] --> start",
    "    start --> done",
    "```",
    "",
    "Texto complementar",
  ].join("\n");

  const html = md(source);

  assert.match(html, /class="code-block-card mermaid-card"/);
  assert.match(html, /<i class="fa-solid fa-diagram-project"><\/i>/);
  assert.match(html, /class="mermaid"/);
  assert.match(html, /stateDiagram-v2/);
  assert.match(html, /class="code-block-content mermaid-raw-source"/);
  assert.match(html, /toggleMermaidSource/);
  assert.match(html, /copyCodeFromContainer/);
});

test("renderMermaidCard: produces clean container with font-awesome icons and no emojis", () => {
  const card = renderMermaidCard({ content: "flowchart TD\n A --> B" });
  assert.match(card, /fa-solid fa-diagram-project/);
  assert.match(card, /fa-solid fa-code/);
  assert.match(card, /fa-regular fa-copy/);
  // Garante que nao haja emojis
  assert.doesNotMatch(card, /[\u{1F300}-\u{1FAFF}]/u, "Emojis are prohibited");
});

test("mermaid files: check file size limits and emoji rules", () => {
  const root = path.resolve(__dirname, "..");
  const files = [
    "ui/public/js/shared/mermaid-renderer.js",
    "ui/public/js/shared/markdown-code.js",
    "ui/public/css/shared/mermaid.css",
  ];

  for (const rel of files) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    const lines = content.split("\n").length;
    assert.ok(lines <= 250, `${rel} has ${lines} lines, exceeding 250 limit`);
    assert.doesNotMatch(content, /[\u{1F300}-\u{1FAFF}]/u, `${rel} contains forbidden emojis`);
  }
});

test("static server: serves mermaid bundle dynamically from node_modules", () => {
  const { serveStatic } = require("../ui/server/controllers/static.controller");
  let statusCode = 0;
  let sentData = null;
  let sentType = "";
  const res = {
    writeHead: (code, headers) => {
      statusCode = code;
      sentType = headers["Content-Type"];
    },
    end: (data) => {
      sentData = data;
    },
  };
  serveStatic(res, "/js/vendor/mermaid.min.js");
  assert.equal(statusCode, 200);
  assert.equal(sentType, "application/javascript");
  assert.ok(sentData && sentData.length > 100000);
});


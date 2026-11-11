// @ts-check
// Every @auto scenario (CP-nn) in docs/features/*/02-bdd.feature must be named in a test title in tests/*.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const featuresDir = path.join(root, "docs", "features");

/** Ids of the @auto scenarios in one .feature text. */
function autoScenarioIds(text) {
  const ids = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(/^\s*Cen[aá]rio:\s*([A-Z]+-\d+)/);
    if (m && /@auto\b/.test(lines[i - 1] || "")) ids.push(m[1]);
  });
  return ids;
}

/** Text of every test title (first string of each test call) across tests/*.test.js. */
function testTitles() {
  const dir = __dirname;
  return fs.readdirSync(dir).filter((n) => n.endsWith(".test.js") && n !== "bdd-traceability.test.js")
    .flatMap((n) => [...fs.readFileSync(path.join(dir, n), "utf8").matchAll(/^\s*test\(\s*["'`]([^"'`]+)["'`]/gm)].map((m) => m[1]));
}

test("every @auto BDD scenario is named in a test title", () => {
  if (!fs.existsSync(featuresDir)) return;
  const titles = testTitles().join("\n");
  const missing = [];
  for (const slug of fs.readdirSync(featuresDir)) {
    const file = path.join(featuresDir, slug, "02-bdd.feature");
    if (!fs.existsSync(file)) continue;
    for (const id of autoScenarioIds(fs.readFileSync(file, "utf8"))) {
      if (!new RegExp(`\\b${id}\\b`).test(titles)) missing.push(`${slug}/${id}`);
    }
  }
  assert.deepEqual(missing, [], `@auto scenarios without a test title: ${missing.join(", ")}`);
});

test("autoScenarioIds only returns scenarios tagged @auto", () => {
  const text = "  @auto\n  Cenario: CP-01 a\n  @manual\n  Cenario: CP-02 b\n";
  assert.deepEqual(autoScenarioIds(text), ["CP-01"]);
});

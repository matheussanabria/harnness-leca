// @ts-check
// Testes — Auditoria visual do Design System (EP-11.04).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { scanContentForVisualIssues, auditProjectDesignSystem } = require("../ui/server/services/audit/design-system-audit.service");
const { apiProjectAuditDesignSystem } = require("../ui/server/controllers/audit.controller");

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-audit-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test("RF1: detecta cores hardcoded e sugere token", () => {
  const issues = scanContentForVisualIssues(".a{color:#0284c7;background:rgba(1,2,3,0.5)}", "design/a.css");
  assert.equal(issues.filter((i) => i.type === "color-token").length, 2);
  assert.match(issues[0].suggestion, /primary-interactive/);
});

test("RF3: detecta emoji", () => {
  const issues = scanContentForVisualIssues("<b>\u{1F680} ok</b>", "design/a.html");
  assert.equal(issues[0].type, "emoji");
});

test("RF2: tokens ausentes viram erro estrutural e reduzem score", () => {
  const dir = tmpProject({ "design/a.css": ".a{color:#fff}" });
  const report = auditProjectDesignSystem(dir);
  assert.equal(report.tokensFound, false);
  assert.equal(report.compliant, false);
  assert.ok(report.score < 100);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("projeto conforme: tokens presentes e sem violações", () => {
  const dir = tmpProject({ "design/ds/tokens.css": ":root{--a:#fff}", "design/ds/theme.css": ":root{--b:var(--a)}", "design/x.css": ".a{color:var(--b)}" });
  const report = auditProjectDesignSystem(dir);
  assert.equal(report.compliant, true);
  assert.equal(report.score, 100);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("endpoint: projeto inexistente devolve 404", async () => {
  const res = { statusCode: 0, writeHead(c) { this.statusCode = c; }, setHeader() {}, end(b) { this.body = b; } };
  await apiProjectAuditDesignSystem({ res, params: ["projeto-inexistente-xyz"] });
  assert.equal(res.statusCode, 404);
});

test("RF6: painel renderiza com FontAwesome e sem emojis", async () => {
  const { renderDesignSystemAudit } = await import(pathToFileURL(path.resolve("ui/public/js/modules/design-audit-ds.js")).href);
  const html = renderDesignSystemAudit({ score: 70, compliant: false, totalIssues: 1, tokensFound: false, issues: [{ severity: "warning", relPath: "a.css", line: 1, message: "m", suggestion: "s" }] });
  assert.ok(html.includes("fa-palette"));
  assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(html));
});

test("RF7: renderDesignSystemSection monta no container host", async () => {
  const { renderDesignSystemSection } = await import(pathToFileURL(path.resolve("ui/public/js/modules/design-audit-ds.js")).href);
  const host = { innerHTML: "" };
  const container = {
    querySelector(sel) {
      if (sel === "#auditDesignSystemBody") return host;
      return null;
    },
  };
  // Mock global fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      score: 100,
      compliant: true,
      totalIssues: 0,
      tokensFound: true,
      issues: [],
    }),
  });
  try {
    await renderDesignSystemSection(container, "demo-proj");
    assert.ok(host.innerHTML.includes("Conformidade do Design System"));
    assert.ok(host.innerHTML.includes("100%"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

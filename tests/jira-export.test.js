// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exportJiraSnapshot } = require("../tools/lib/jira-export");

function fakeJira(calls) {
  return async (url) => {
    calls.push(url);
    const body = url.includes("/field") ? [{ id: "customfield_10100", name: "Sprint", custom: true }]
      : url.includes("/issue/DIS-1/comment") ? { comments: [{ id: "1" }, { id: "2" }] }
      : { total: 1, issues: [{ key: "DIS-1", fields: { customfield_10100: ["x"], comment: { total: 2, comments: [{ id: "1" }] } } }] };
    return { ok: true, status: 200, json: async () => body };
  };
}

test("exporta pedindo sprint e comentarios e completa comentarios truncados", async () => {
  const calls = [];
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "jira-")), "doc", "_jira-dis.json");
  const result = await exportJiraSnapshot({ baseUrl: "https://j.example/", token: "t", project: "DIS", out, fetchImpl: /** @type {any} */ (fakeJira(calls)) });
  const saved = JSON.parse(fs.readFileSync(out, "utf8"));

  assert.equal(result.issues, 1);
  assert.equal(result.withSprint, 1);
  assert.equal(saved[0].fields.comment.comments.length, 2);
  assert.ok(calls.some((url) => url.includes("customfield_10100") && url.includes("comment")));
});

test("recusa exportar sem credenciais", async () => {
  await assert.rejects(exportJiraSnapshot({ baseUrl: "", token: "", project: "DIS", out: "x" }), /JIRA_BASE_URL/);
});

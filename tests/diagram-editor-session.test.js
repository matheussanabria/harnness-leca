// EP-21.04: save session (CP-05) and starter templates (CP-07). Fakes only: no DOM, no Mermaid, no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const src = (...parts) => pathToFileURL(path.join(__dirname, "../ui/web/src/features", ...parts)).href;
const load = (...parts) => import(src(...parts));

/** Promise with external resolvers, to control the order in which async work finishes. */

// ---------------------------------------------------------------------------
// CP-05: diagram save session (revision handling)
// ---------------------------------------------------------------------------

/** Fake API: records each update and answers with the next revision. */
function fakeApi(failWith = null) {
  const calls = [];
  const api = {
    async update(id, patch) {
      calls.push({ id, patch });
      if (failWith) throw failWith;
      return { rev: patch.rev + 1 };
    },
  };
  return { api, calls };
}

test("CP-05 session: two consecutive saves send rev 3 then rev 4 with the mermaid@1 payload", async () => {
  const { createDiagramSession } = await load("diagram", "session.ts");
  const { api, calls } = fakeApi();
  const session = createDiagramSession(api, "d1", { rev: 3 });

  await session.save("flowchart TD\n A-->B", "flowchart-v2");
  await session.save("flowchart TD\n A-->C", "flowchart-v2");

  assert.equal(calls.length, 2);
  assert.equal(calls[0].id, "d1");
  assert.equal(calls[0].patch.rev, 3);
  assert.deepEqual(calls[0].patch.data, {
    schema: "mermaid@1",
    diagramType: "flowchart-v2",
    source: "flowchart TD\n A-->B",
  });
  assert.equal(calls[1].patch.rev, 4);
  assert.equal(calls[1].patch.data.source, "flowchart TD\n A-->C");
  assert.equal(session.rev(), 5);
});

test("CP-05 session: rename sends the current rev and advances it", async () => {
  const { createDiagramSession } = await load("diagram", "session.ts");
  const { api, calls } = fakeApi();
  const session = createDiagramSession(api, "d1", { rev: 3 });

  await session.rename("Novo titulo");

  assert.deepEqual(calls, [{ id: "d1", patch: { rev: 3, title: "Novo titulo" } }]);
  assert.equal(session.rev(), 4);
});

test("CP-05 session: a failed update propagates the error and keeps the revision", async () => {
  const { createDiagramSession } = await load("diagram", "session.ts");
  const conflict = Object.assign(new Error("conflict"), { status: 409 });
  const { api } = fakeApi(conflict);
  const session = createDiagramSession(api, "d1", { rev: 3 });

  await assert.rejects(session.save("flowchart TD\n A-->B", "flowchart-v2"), (error) => error === conflict);
  assert.equal(session.rev(), 3);

  await assert.rejects(session.rename("x"), (error) => error === conflict);
  assert.equal(session.rev(), 3);
});

// ---------------------------------------------------------------------------
// CP-07: starter templates
// ---------------------------------------------------------------------------

test("CP-07 templates: six templates with unique keys", async () => {
  const { TEMPLATES } = await load("diagram", "templates.ts");

  assert.equal(TEMPLATES.length, 6);
  const keys = TEMPLATES.map((template) => template.key);
  assert.deepEqual([...keys].sort(), ["class", "er", "flowchart", "gantt", "sequence", "state"]);
  assert.equal(new Set(keys).size, keys.length);
});

test("CP-07 templates: each source is detected as the template's own supported type", async () => {
  const { TEMPLATES } = await load("diagram", "templates.ts");
  const { detectType } = await load("diagram", "detect.ts");

  for (const template of TEMPLATES) {
    assert.deepEqual(detectType(template.source), { kind: "supported", type: template.type }, template.key);
  }
});

test("CP-07 templates: each template payload is readable as mermaid@1 with the same source", async () => {
  const { TEMPLATES, templateData } = await load("diagram", "templates.ts");
  const { readDiagramData } = await load("diagram", "data.ts");

  for (const template of TEMPLATES) {
    const data = readDiagramData(templateData(template));
    assert.notEqual(data, null, template.key);
    assert.equal(data.source, template.source, template.key);
    assert.equal(data.diagramType, template.type, template.key);
  }
});

test("CP-07 templates: findTemplate finds a known key and returns undefined for an unknown one", async () => {
  const { findTemplate } = await load("diagram", "templates.ts");

  assert.equal(findTemplate("er")?.key, "er");
  assert.equal(findTemplate("nada"), undefined);
});

test("CP-07 templates: the ER relationship label with accents is quoted", async () => {
  const { findTemplate } = await load("diagram", "templates.ts");

  assert.ok(findTemplate("er").source.includes(': "contém"'), findTemplate("er").source);
});


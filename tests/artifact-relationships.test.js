// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const {
  RELATIONSHIPS_REL,
  MAX_LINKS,
  screenFieldKey,
  readRelationshipState,
  collectRelationshipTargets,
  buildRelationshipReport,
  setArtifactRelationship,
} = require("../ui/server/services/artifact-relationships.service");
const { updateArtifactAccess } = require("../ui/server/services/artifact-metadata.service");
const {
  apiProjectArtifactsRelationships,
  apiProjectArtifactsRelationshipsUpdate,
} = require("../ui/server/controllers/artifact-relationships.controller");
const { artifactRoutes } = require("../ui/server/routes/artifact.routes");

const SCREENS = [
  {
    id: "s1",
    route: "sistema/consulta",
    title: "Consulta",
    fields: [{ id: "f01", label: "Busca" }, { id: "f02", label: "Tabela" }],
  },
  {
    id: "s1",
    route: "sistema/outra",
    title: "Outra tela",
    fields: [{ id: "f01", label: "Ação" }],
  },
];

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifact-rel-"));
  fs.mkdirSync(path.join(dir, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "artifacts", "foto.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return dir;
}

function seededProject(slug) {
  const dir = path.join(__dirname, "..", "projects", slug);
  fs.mkdirSync(path.join(dir, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "artifacts", "foto.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return dir;
}

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq({ local = true, body = null } = {}) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  return req;
}

test("artifact-relationships: chave de tela/campo é estável e não colide entre rotas", () => {
  const first = screenFieldKey("sistema/consulta", "s1", "f01");
  const second = screenFieldKey("sistema/outra", "s1", "f01");
  assert.match(first, /^screen:/);
  assert.notEqual(first, second);
  assert.equal(screenFieldKey("sistema/consulta", "s1", "f01"), first);
  assert.equal(screenFieldKey("", "s2", "f01"), "screen:s2|s2#field:f01");

  const info = collectRelationshipTargets(SCREENS);
  assert.equal(info.targets.length, 3);
  assert.equal(info.byKey.get(first)?.fieldLabel, "Busca");
  assert.equal(info.byKey.get(second)?.screenTitle, "Outra tela");
});

test("artifact-relationships: adiciona, remove e relata vínculos resolvidos", () => {
  const root = project();
  try {
    const artifactKey = "imported:artifacts/foto.png";
    const allowed = new Set([artifactKey]);
    const info = collectRelationshipTargets(SCREENS);
    const [targetA, targetB] = info.targets;

    const added = setArtifactRelationship(root, { artifactKey, targetKey: targetA.key, action: "add" }, info, allowed);
    assert.equal(added.changed, true);
    assert.equal(added.totals.links, 1);
    assert.equal(added.items[artifactKey][0].fieldId, targetA.fieldId);
    assert.equal(fs.readFileSync(path.join(root, RELATIONSHIPS_REL), "utf8").includes(root), false);

    const duplicate = setArtifactRelationship(root, { artifactKey, targetKey: targetA.key, action: "add" }, info, allowed);
    assert.equal(duplicate.changed, false);
    assert.equal(duplicate.totals.links, 1);

    setArtifactRelationship(root, { artifactKey, targetKey: targetB.key, action: "add" }, info, allowed);
    const removed = setArtifactRelationship(root, { artifactKey, targetKey: targetA.key, action: "remove" }, info, allowed);
    assert.equal(removed.changed, true);
    assert.equal(removed.totals.links, 1);
    assert.equal(removed.items[artifactKey][0].key, targetB.key);

    const state = readRelationshipState(root);
    assert.equal(state.error, "");
    assert.equal(state.items[artifactKey].length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-relationships: rejeita artefato, destino e ação inválidos", () => {
  const root = project();
  try {
    const artifactKey = "imported:artifacts/foto.png";
    const info = collectRelationshipTargets(SCREENS);
    const targetKey = info.targets[0].key;
    const allowed = new Set([artifactKey]);

    assert.throws(
      () => setArtifactRelationship(root, { artifactKey: "imported:artifacts/outro.png", targetKey, action: "add" }, info, allowed),
      (err) => /** @type {any} */ (err).status === 400,
    );
    assert.throws(
      () => setArtifactRelationship(root, { artifactKey, targetKey: screenFieldKey("x", "s9", "f99"), action: "add" }, info, allowed),
      (err) => /** @type {any} */ (err).status === 400,
    );
    assert.throws(
      () => setArtifactRelationship(root, { artifactKey, targetKey, action: "replace" }, info, allowed),
      (err) => /** @type {any} */ (err).status === 400,
    );
    assert.equal(fs.existsSync(path.join(root, RELATIONSHIPS_REL)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-relationships: vínculo órfão é listado e pode ser removido", () => {
  const root = project();
  try {
    const artifactKey = "imported:artifacts/foto.png";
    const orphanKey = screenFieldKey("sistema/removida", "s9", "f99");
    fs.writeFileSync(path.join(root, RELATIONSHIPS_REL), JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      items: { [artifactKey]: [orphanKey] },
    }), "utf8");
    const allowed = new Set([artifactKey]);
    const info = collectRelationshipTargets(SCREENS);

    const report = buildRelationshipReport(root, info, allowed);
    assert.equal(report.totals.unresolved, 1);
    assert.equal(report.items[artifactKey], undefined);
    assert.equal(report.unresolved[0].targetKey, orphanKey);

    const removed = setArtifactRelationship(root, { artifactKey, targetKey: orphanKey, action: "remove" }, info, allowed);
    assert.equal(removed.changed, true);
    assert.equal(removed.totals.unresolved, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-relationships: arquivo inválido não derruba a leitura e bloqueia escrita", () => {
  const root = project();
  try {
    fs.writeFileSync(path.join(root, RELATIONSHIPS_REL), "{ inválido", "utf8");
    const state = readRelationshipState(root);
    assert.match(state.error, /inválido/i);
    assert.deepEqual(state.items, {});

    const info = collectRelationshipTargets(SCREENS);
    assert.throws(
      () => setArtifactRelationship(root, {
        artifactKey: "imported:artifacts/foto.png",
        targetKey: info.targets[0].key,
        action: "add",
      }, info, new Set(["imported:artifacts/foto.png"])),
      (err) => /** @type {any} */ (err).status === 500,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-relationships: respeita o limite de vínculos por artefato", () => {
  const root = project();
  try {
    const screens = [{ id: "s1", route: "sistema/limite", title: "Limite", fields: Array.from({ length: MAX_LINKS + 1 }, (_, index) => ({ id: `f${index + 1}`, label: `Campo ${index + 1}` })) }];
    const info = collectRelationshipTargets(screens);
    const artifactKey = "imported:artifacts/foto.png";
    const allowed = new Set([artifactKey]);
    fs.writeFileSync(path.join(root, RELATIONSHIPS_REL), JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      items: { [artifactKey]: info.targets.slice(0, MAX_LINKS).map((target) => target.key) },
    }), "utf8");

    assert.throws(
      () => setArtifactRelationship(root, { artifactKey, targetKey: info.targets[MAX_LINKS].key, action: "add" }, info, allowed),
      (err) => /** @type {any} */ (err).status === 409,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-relationships: controller lista, grava, bloqueia remoto e filtra local", async () => {
  const slug = `tmp-artifact-rel-${process.pid}-${Date.now()}`;
  const dir = seededProject(slug);
  try {
    const local = fakeRes();
    await apiProjectArtifactsRelationships({ req: fakeReq({ local: true }), res: local, params: [slug] });
    assert.equal(local.status, 200);
    const listed = JSON.parse(local.body);
    assert.equal(listed.canManage, true);
    assert.ok(listed.targets.length >= 2);
    const targetKey = listed.targets[0].key;

    const added = fakeRes();
    await apiProjectArtifactsRelationshipsUpdate({
      req: fakeReq({ local: true, body: { artifactKey: "imported:artifacts/foto.png", targetKey, action: "add" } }),
      res: added,
      params: [slug],
    });
    assert.equal(added.status, 200);
    assert.equal(JSON.parse(added.body).totals.links, 1);

    const remote = fakeRes();
    await apiProjectArtifactsRelationshipsUpdate({
      req: fakeReq({ local: false, body: { artifactKey: "imported:artifacts/foto.png", targetKey, action: "add" } }),
      res: remote,
      params: [slug],
    });
    assert.equal(remote.status, 403);

    updateArtifactAccess(dir, "artifacts/foto.png", "local");
    const remoteList = fakeRes();
    await apiProjectArtifactsRelationships({ req: fakeReq({ local: false }), res: remoteList, params: [slug] });
    assert.equal(remoteList.status, 200);
    assert.equal(JSON.parse(remoteList.body).items["imported:artifacts/foto.png"], undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artifact-relationships: rotas registradas e arquivos abaixo de 300 linhas", () => {
  const getRoute = artifactRoutes.find((route) => route.method === "GET" && route.path.test("/api/project/demo/artifacts/relationships"));
  const postRoute = artifactRoutes.find((route) => route.method === "POST" && route.path.test("/api/project/demo/artifacts/relationships"));
  assert.equal(getRoute?.handler?.name, "apiProjectArtifactsRelationships");
  assert.equal(postRoute?.handler?.name, "apiProjectArtifactsRelationshipsUpdate");

  const files = [
    "ui/server/services/artifact-relationships.service.js",
    "ui/server/controllers/artifact-relationships.controller.js",
    "ui/server/routes/artifact.routes.js",
    "ui/public/js/modules/design-artifacts-relationships.js",
    "ui/public/js/modules/design-artifacts.js",
    "ui/public/js/modules/design.js",
    "ui/public/css/design/20-artifact-relationships.css",
    "tests/artifact-relationships.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    if (file !== "ui/public/js/modules/design.js") {
      assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
    }
  }
  assert.match(fs.readFileSync(path.join(__dirname, "..", "ui/public/js/modules/design-artifacts-relationships.js"), "utf8"), /harness:open-layer-target/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { reviewPackageTitle, reviewPackageDoneMessage, reviewPackageButtonHtml } from "../ui/public/js/modules/design-scrum-review-package.js";

const require = createRequire(import.meta.url);
const { fingerprint, writeManifest } = require("../tools/pacote-revisao/manifest.js");
const { packageStatus } = require("../tools/pacote-revisao/status.js");

const config = (pasta) => ({
  titulo: "Quadro",
  pasta,
  historias: ["DIS-1"],
  colunas: [{ id: "a", nome: "A fazer" }],
  statusParaColuna: { "a fazer": "a" },
});

/** Pasta de projetos ficticia: <projects>/<slug>/{mcp.json,pacote-revisao.json} e um repo vazio. */
function fakeProjects({ withConfig = true, withRepo = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pacote-botao-"));
  const projects = path.join(dir, "projects");
  const repo = path.join(dir, "repo");
  const out = path.join(dir, "saida");
  fs.mkdirSync(path.join(projects, "demo"), { recursive: true });
  fs.mkdirSync(path.join(repo, "doc", "sistema", "features", "x"), { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(repo, "doc", "sistema", "features", "x", "mapa-camadas.json"), "{}");
  if (withRepo) fs.writeFileSync(path.join(projects, "demo", "mcp.json"), JSON.stringify({ repo }));
  if (withConfig) fs.writeFileSync(path.join(projects, "demo", "pacote-revisao.json"), JSON.stringify(config(out)));
  return { projects, repo, out };
}

/** Resposta HTTP minima que o `send` do servidor entende. */
function fakeRes() {
  const r = { headersSent: false, writableEnded: false, code: 0, body: "" };
  r.writeHead = (code) => { r.code = code; };
  r.end = (body) => { r.body = body; r.writableEnded = true; };
  r.json = () => JSON.parse(r.body);
  return r;
}

async function withProjects(fake, fn) {
  const before = process.env.HARNESS_PROJECTS_DIR;
  process.env.HARNESS_PROJECTS_DIR = fake.projects;
  try {
    const controller = require("../ui/server/controllers/pacote-revisao.controller.js");
    return await fn(controller);
  } finally {
    if (before === undefined) delete process.env.HARNESS_PROJECTS_DIR;
    else process.env.HARNESS_PROJECTS_DIR = before;
  }
}

test("CP-01: projeto sem configuracao de pacote nao mostra o botao", async () => {
  const fake = fakeProjects({ withConfig: false });
  await withProjects(fake, async ({ apiProjectPacoteRevisaoStatus }) => {
    const res = fakeRes();
    await apiProjectPacoteRevisaoStatus({ res, params: ["demo"] });
    assert.equal(res.code, 200);
    assert.deepEqual(res.json(), { configured: false });
  });
});

test("CP-02: estado do pacote diz quando foi gerado e o que ficou defasado", async () => {
  const fake = fakeProjects();
  const ctx = { slug: "demo", repo: fake.repo, projectDir: path.join(fake.projects, "demo"), configFile: path.join(fake.projects, "demo", "pacote-revisao.json"), outDir: fake.out, historias: ["DIS-1"] };
  writeManifest(fake.out, { geradoEm: "2026-11-01T10:00:00.000Z", fontes: fingerprint(ctx) });
  fs.writeFileSync(path.join(fake.repo, "doc", "sistema", "features", "x", "mapa-camadas.json"), '{"mudou":true}');
  await withProjects(fake, async ({ apiProjectPacoteRevisaoStatus }) => {
    const res = fakeRes();
    await apiProjectPacoteRevisaoStatus({ res, params: ["demo"] });
    const body = res.json();
    assert.equal(body.configured, true);
    assert.equal(body.geradoEm, "2026-11-01T10:00:00.000Z");
    assert.deepEqual(body.defasado, ["mapa-camadas.json"]);
    assert.equal(body.pasta, fake.out);
  });
});

test("CP-03: pacote nunca gerado aparece como pendente", () => {
  const fake = fakeProjects();
  const status = packageStatus({ repo: fake.repo, projectDir: path.join(fake.projects, "demo"), configFile: path.join(fake.projects, "demo", "pacote-revisao.json"), outDir: fake.out, config: config(fake.out) });
  assert.equal(status.geradoEm, null);
  assert.deepEqual(status.defasado, []);
});

test("CP-04: geracao simultanea e recusada", async () => {
  const fake = fakeProjects({ withRepo: false });
  await withProjects(fake, async ({ apiProjectPacoteRevisaoBuild }) => {
    const first = fakeRes();
    const second = fakeRes();
    const running = apiProjectPacoteRevisaoBuild({ res: first, params: ["demo"] });
    await apiProjectPacoteRevisaoBuild({ res: second, params: ["demo"] });
    assert.equal(second.code, 409);
    assert.match(second.json().error, /Ja existe um pacote/);
    await running;
  });
});

test("CP-05: falha da ferramenta chega como erro legivel", async () => {
  const fake = fakeProjects({ withRepo: false });
  await withProjects(fake, async ({ apiProjectPacoteRevisaoBuild }) => {
    const res = fakeRes();
    await apiProjectPacoteRevisaoBuild({ res, params: ["demo"] });
    assert.equal(res.code, 500);
    assert.match(res.json().error, /nao declara "repo" em mcp\.json/);
    const missing = fakeRes();
    await apiProjectPacoteRevisaoBuild({ res: missing, params: ["outro"] });
    assert.equal(missing.code, 404);
  });
});

test("CP-06: texto do botao e dos avisos reflete o estado", () => {
  assert.match(reviewPackageTitle({ geradoEm: null, pasta: "C:/x" }), /Ainda não gerado.*C:\/x/);
  assert.match(reviewPackageTitle({ geradoEm: "2026-11-01T10:00:00Z", defasado: [] }), /Em dia com as fontes/);
  assert.match(reviewPackageTitle({ geradoEm: "2026-11-01T10:00:00Z", defasado: ["snapshot do Jira", "mapa-camadas.json"] }), /Defasado, mudou: snapshot do Jira, mapa-camadas\.json/);
  assert.match(reviewPackageTitle({ error: "sem repo" }), /indisponível: sem repo/);
  const done = reviewPackageDoneMessage({ historias: 16, telas: 18, zip: "C:/p.zip", avisos: [{}, {}] });
  assert.match(done, /16 histórias e 18 telas/);
  assert.match(done, /Zip: C:\/p\.zip/);
  assert.match(done, /2 aviso\(s\)/);
  assert.match(reviewPackageButtonHtml(), /id="scrumReviewPackageBtn"[\s\S]*hidden[\s\S]*Gerar pacote de revisão/);
});

// @ts-check
// Feature dossier of a workflow run: folder + _status.md created at the start, stage registry kept in sync,
// per-stage prompt (where to write, what to read) and the two permission levels.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-dossier-"));
process.env.HARNESS_ROOT = ROOT;
const SLUG = "projeto-dossie";
const projectDir = path.join(ROOT, "projects", SLUG);
const REPO = path.join(ROOT, "repo");
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(REPO, { recursive: true });
fs.writeFileSync(path.join(projectDir, "mcp.json"), JSON.stringify({ repo: REPO }));
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
 closeStore(SLUG);
 removeDir(ROOT);
});

const paths = require("../ui/server/services/orchestration/workflow-dossier-paths");
const { runWorkflowCommand, cardForExecution } = require("../ui/server/services/orchestration/workflow-command.service");
const { advanceWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");

const start = (text) => runWorkflowCommand({ slug: SLUG, projectDir, text });
const statusOf = (rel) => fs.readFileSync(path.join(REPO, rel, "_status.md"), "utf8");

test("paths: slug, feature name and unsafe relative folders", () => {
 assert.equal(paths.slugify("Integração: Mapa de Documentação!"), "integracao-mapa-de-documentacao");
 assert.equal(paths.featureSlug({ storyKey: "US-123", seed: "Cadastro de cliente" }), "us-123-cadastro-de-cliente");
 assert.match(paths.featureSlug({ seed: "Cadastro", now: new Date("2026-11-11T12:00:00Z") }), /^20261111-cadastro$/);
 assert.equal(paths.safeRelative("../fora"), "");
 assert.equal(paths.safeRelative("C:/x"), "");
 assert.equal(paths.safeRelative("/doc/features/"), "doc/features");
});

test("root: repo default, project override, fallback inside the harness project", () => {
 assert.equal(paths.resolveDossierRoot(projectDir).rel, "docs/features");
 fs.writeFileSync(path.join(projectDir, "dossier.json"), JSON.stringify({ dir: "doc/sistema/features" }));
 assert.equal(paths.resolveDossierRoot(projectDir).rel, "doc/sistema/features");
 fs.writeFileSync(path.join(projectDir, "dossier.json"), JSON.stringify({ dir: "../escape" }));
 assert.equal(paths.resolveDossierRoot(projectDir).rel, "docs/features", "traversal ignored");
 fs.rmSync(path.join(projectDir, "dossier.json"));
 const bare = path.join(ROOT, "projects", "sem-repo");
 fs.mkdirSync(bare, { recursive: true });
 assert.equal(paths.resolveDossierRoot(bare).source, "harness");
});

test("start creates the dossier and _status.md; the story prompt says where to write", () => {
 const out = start("/workflow feature-delivery Cadastro de cliente --story US-7");
 assert.equal(out.ok, true);
 const rel = out.card.dossier;
 assert.equal(rel, "docs/features/us-7-cadastro-de-cliente");
 const status = statusOf(rel);
 assert.match(status, /^---\nexecutionId: wf-/);
 assert.match(status, /story: US-7/);
 assert.match(status, /evidence: declared/);
 assert.match(status, /\| Início \(start\) \| done \|/);
 assert.match(status, /\| História \(story\) \| pending \|\s+\| 01-story\.md \|/);

 assert.equal(out.card.output.file, "01-story.md");
 assert.equal(out.card.output.exists, false);
 assert.match(out.card.stagePrompt, /Dossiê da entrega: docs\/features\/us-7-cadastro-de-cliente/);
 assert.match(out.card.stagePrompt, /Grave o resultado desta etapa em docs\/features\/us-7-cadastro-de-cliente\/01-story\.md/);
 assert.match(out.card.stagePrompt, /Fora do dossiê, não altere arquivos nem código/);
 assert.doesNotMatch(out.card.stagePrompt, /somente leitura/);
});

test("the stage file is detected, the registry follows the run and the next stage reads the previous file", () => {
 const out = start("/workflow feature-delivery Segunda entrega --story US-8");
 const id = out.card.executionId;
 const dir = path.join(REPO, out.card.dossier);
 assert.equal(cardForExecution(SLUG, projectDir, id).output.exists, false);

 fs.writeFileSync(path.join(dir, "01-story.md"), "# Historia\n- criterio 1\n");
 assert.equal(cardForExecution(SLUG, projectDir, id).output.exists, true);

 advanceWorkflowRun(id, { stageId: "story", status: "completed" });
 const next = cardForExecution(SLUG, projectDir, id);
 assert.equal(next.stageId, "bdd");
 assert.match(next.stagePrompt, /Leia antes: docs\/features\/us-8-segunda-entrega\/01-story\.md/);
 assert.match(next.stagePrompt, /Grave o resultado desta etapa em .*02-bdd\.feature/);
 assert.match(statusOf(out.card.dossier), /\| História \(story\) \| done \|/);
});

test("code stages may touch code in their own worktree; other stages stay inside the dossier", () => {
 const out = start("/workflow feature-delivery Implementar --story US-9 --from dev");
 assert.equal(out.ok, true);
 assert.match(out.card.stagePrompt, /pode alterar código e executar comandos, em um worktree e uma branch próprios \(feat\/us-9-implementar\)/);
 assert.match(out.card.stagePrompt, /05-dev-notas\.md/);
 const status = statusOf(out.card.dossier);
 assert.match(status, /\| História \(story\) \| skipped \| Retomado a partir de 'dev' \|/);
});

test("two runs with the same name get separate dossiers", () => {
 const a = start("/workflow feature-delivery Mesmo nome --story US-10");
 const b = start("/workflow feature-delivery Mesmo nome --story US-10");
 assert.notEqual(a.card.dossier, b.card.dossier);
 assert.match(b.card.dossier, /^docs\/features\/us-10-mesmo-nome-[a-z0-9-]{4}$/);
 assert.match(statusOf(a.card.dossier), new RegExp(`executionId: ${a.card.executionId}`));
});

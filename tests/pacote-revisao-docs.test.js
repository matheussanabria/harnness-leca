// Phase 3 of the docs reader: documentation embedded in the static review package, references to documents
// left out of it, and the `check` finding for them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { embeddedDocsSource } from "../ui/public/js/modules/design-layers/docs/docs-source.js";
import { renderDocument } from "../ui/public/js/modules/design-layers/docs/docs-render.js";
import { docChip } from "../ui/public/js/modules/design-layers/layers-docs-refs.js";
import { dls } from "../ui/public/js/modules/design-layers-store.js";

const require = createRequire(import.meta.url);
const { collectDocs, alignPaths } = require("../tools/pacote-revisao/docs-data.js");
const { runCheck } = require("../tools/pacote-revisao/check.js");
const { fingerprint } = require("../tools/pacote-revisao/manifest.js");

function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** Project repo with two stories and one rule; package folder with part of it (story folder in other case). */
function makeProject() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "pacote-docs-repo-"));
  const F = "doc/sistema/features/calc";
  write(repo, `${F}/_status.md`, "---\r\nhistorias:\r\n  - DIS-443 principal\r\n  - DIS-454 secundaria\r\n---\r\n");
  write(repo, `${F}/regras.md`, "| RN-calc-001 | Regra um |\r\n");
  write(repo, "doc/scrum/DIS-443/user-story.md", "# DIS-443 Integração\n- **Critério 1:** x\n[[dis-454/user-story]]\n");
  write(repo, "doc/scrum/dis-454/user-story.md", "# DIS-454 Cobertura\n");
  write(repo, ".gitignore", "# Contêm segredo\r\n/doc/privado/*.md\r\n");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "pacote-docs-out-"));
  write(out, `${F}/_status.md`, fs.readFileSync(path.join(repo, `${F}/_status.md`), "utf8"));
  write(out, `${F}/regras.md`, fs.readFileSync(path.join(repo, `${F}/regras.md`), "utf8"));
  write(out, "doc/scrum/DIS-454/user-story.md", "# DIS-454 Cobertura\n");
  write(out, "doc/privado/senha.md", "segredo");
  write(out, "doc/postman/api.postman_collection.json", "{}");
  write(out, "doc/.obsidian/app.json", "{}");
  return { repo, out };
}
const SCREENS = [{ id: "s2", feature: "calc", rules: [{ rn: ["RN-calc-001"] }] }];

test("CP-D1: only the package folder is embedded, without secrets, Postman files or dot folders", () => {
  const { repo, out } = makeProject();
  const { data } = collectDocs({ repo, outDir: out, screens: SCREENS });
  assert.deepEqual(Object.keys(data.files).sort(), ["scrum/DIS-454/user-story.md", "sistema/features/calc/_status.md", "sistema/features/calc/regras.md"]);
  assert.deepEqual(data.refs.included, Object.keys(data.files).sort());
  assert.ok(data.paths.includes("scrum/DIS-443/user-story.md"), "links resolve against the whole project");
});

test("CP-D2: a path spelled with other case in the package is the same document", () => {
  const { repo, out } = makeProject();
  const { data, foraDoPacote } = collectDocs({ repo, outDir: out, screens: SCREENS });
  assert.equal(data.refs.stories["DIS-454"].path, "scrum/DIS-454/user-story.md");
  assert.ok(!foraDoPacote.some((d) => /454/.test(d.path)));
  assert.deepEqual(alignPaths({ a: ["X/Y.md"], b: "z" }, new Map([["x/y.md", "x/Y.md"]])), { a: ["x/Y.md"], b: "z" });
});

test("CP-D3: documents the map cites but the package lacks are listed with who cites them", () => {
  const { repo, out } = makeProject();
  const { foraDoPacote } = collectDocs({ repo, outDir: out, screens: SCREENS });
  assert.deepEqual(foraDoPacote, [{ path: "scrum/DIS-443/user-story.md", refs: ["DIS-443"] }]);
});

test("CP-D4: check reports DOC_FORA_DO_PACOTE as a warning, never an error", () => {
  const { repo, out } = makeProject();
  const docs = collectDocs({ repo, outDir: out, screens: SCREENS });
  const ctx = { slug: "x", repo, projectDir: repo, configFile: "", outDir: out, config: { statusForcado: [], esconderNoPrototipo: [], historias: [] } };
  const map = { fixes: { absorvidas: [], semAlvo: [] }, protos: {}, screensData: { screens: [] }, docs };
  const found = runCheck({ ctx, map, board: { stories: [] } }).filter((f) => f.code === "DOC_FORA_DO_PACOTE");
  assert.equal(found.length, 1);
  assert.equal(found[0].level, "aviso");
  assert.match(found[0].message, /doc\/scrum\/DIS-443\/user-story\.md.*\(DIS-443\)/);
});

test("CP-D5: in the package, a left-out document opens as 'not included', links and chips say so", async () => {
  const { repo, out } = makeProject();
  const { data } = collectDocs({ repo, outDir: out, screens: SCREENS });
  const source = embeddedDocsSource(data);
  assert.equal((await source.file("sistema/features/calc/regras.md")).text, "| RN-calc-001 | Regra um |\r\n");
  assert.deepEqual(await source.file("scrum/DIS-443/user-story.md"), { error: "não incluído no pacote", status: 404, notInPackage: true });
  const html = renderDocument("[[DIS-443/user-story]] [[calc/regras]]", { path: "x.md", paths: data.paths, isAvailable: source.isIncluded }).html;
  assert.match(html, /doc-link-outside[^>]*>DIS-443\/user-story <small>\(não incluído no pacote\)/);
  assert.match(html, /data-doc-path="sistema\/features\/calc\/regras\.md"/);
  dls.docsRefs = data.refs;
  assert.match(docChip("story", "DIS-443"), /doc-chip-outside/);
  assert.doesNotMatch(docChip("rn", "RN-calc-001"), /doc-chip-outside|doc-chip-missing/);
  dls.docsRefs = null;
});

test("CP-D6: the manifest notices a change in the embedded documentation", () => {
  const { repo, out } = makeProject();
  const args = { repo, projectDir: repo, configFile: path.join(repo, "nao-existe.json"), outDir: out, historias: [] };
  const before = fingerprint(args);
  write(out, "doc/sistema/features/calc/regras.md", "| RN-calc-001 | Regra um, revista |\n");
  const after = fingerprint(args);
  assert.notEqual(after["documentacao embutida no pacote"], before["documentacao embutida no pacote"]);
  assert.equal(after["documentacao do projeto (indice de referencias)"], before["documentacao do projeto (indice de referencias)"]);
});

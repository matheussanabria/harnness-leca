// Documentation reader of the Layers map (browser modules, run in Node): safe rendering, anchors shared with
// the server index, path rules, link format, reference resolution and the screen strip.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { renderDocument } from "../ui/public/js/modules/design-layers/docs/docs-render.js";
import { joinRelative, resolveWikilink, slugify, rnAnchor, criterionAnchor } from "../ui/public/js/modules/design-layers/docs/docs-paths.js";
import { parseDocLocation, docHref, setDocsLinkMode } from "../ui/public/js/modules/design-layers/docs/docs-location.js";
import { refTarget } from "../ui/public/js/modules/design-layers/docs/docs-panel.js";
import { screenDocs, idsInText, docChip, renderScreenDocsBar, renderRuleDocChips, openFromChip } from "../ui/public/js/modules/design-layers/layers-docs-refs.js";
import { dls } from "../ui/public/js/modules/design-layers-store.js";

const require = createRequire(import.meta.url);
const server = require("../ui/server/services/project-docs/refs-parsers.js");

const PATHS = [
  "sistema/features/calculo/regras.md",
  "sistema/features/calculo/_status.md",
  "sistema/features/tela/_status.md",
  "sistema/features/_contrato-rastreio.md",
  "scrum/DIS-443/user-story.md",
];
const render = (text, path = "sistema/features/tela/_status.md") => renderDocument(text, { path, paths: PATHS, hrefFor: (p, a) => `#doc/${p}${a ? `#${a}` : ""}` }).html;

test("render: raw HTML is shown as text, never as markup", () => {
  const html = render('<script>alert(1)</script>\n\nTexto <img src=x onerror="alert(2)"> fim');
  assert.ok(!/<script|<img/i.test(html), html);
  assert.ok(html.includes("&lt;script&gt;"));
});

test("render: javascript: and data: links lose the link, external ones open apart", () => {
  const html = render("[a](javascript:alert(1)) [b](data:text/html,x) [c](https://example.org)");
  assert.ok(!/href="(javascript|data):/i.test(html));
  assert.match(html, /<a class="doc-link-external" href="https:\/\/example\.org" target="_blank" rel="noopener noreferrer">c/);
});

test("render: relative links become reader links; links out of doc/ or to missing files do not", () => {
  const html = render("[r](../calculo/regras.md#rn-calculo-001) [x](../../../../fora.md) [y](nao-existe.md) [z](#topo)");
  assert.match(html, /data-doc-path="sistema\/features\/calculo\/regras\.md" data-doc-anchor="rn-calculo-001"/);
  assert.equal((html.match(/doc-link-missing/g) || []).length, 2);
  assert.match(html, /data-doc-path="sistema\/features\/tela\/_status\.md" data-doc-anchor="topo"/);
});

test("render: wikilinks resolve by folder and by path suffix; unknown ones stay plain", () => {
  const html = render("[[calculo/_status]] [[_contrato-rastreio|contrato]] [[calculo/regras#Regras de negócio]] [[sumiu]] ![[foto.png]]");
  assert.match(html, /data-doc-path="sistema\/features\/calculo\/_status\.md"[^>]*>calculo\/_status</);
  assert.match(html, /data-doc-path="sistema\/features\/_contrato-rastreio\.md"[^>]*>contrato</);
  assert.match(html, /data-doc-anchor="regras-de-negócio"/);
  assert.match(html, /doc-link-missing[^>]*>sumiu</);
  assert.match(html, /foto\.png \(anexo não exibido\)/);
});

test("render: images are not loaded and Mermaid stays as code", () => {
  const html = render("![diagrama](img/x.png)\n\n```mermaid\ngraph TD; A-->B\n```");
  assert.ok(!html.includes("<img"));
  assert.match(html, /Diagrama Mermaid/);
  assert.match(html, /data-lang="mermaid"><code>graph TD; A--&gt;B/);
});

test("render: heading ids keep accents and repeat with a suffix; frontmatter becomes properties", () => {
  const html = render("---\nstatus: rascunho\n---\n# Título\n## Critérios de Aceitação\n## Critérios de Aceitação");
  assert.match(html, /<details class="doc-properties">/);
  assert.match(html, /<h2 id="critérios-de-aceitação">/);
  assert.match(html, /<h2 id="critérios-de-aceitação-1">/);
});

test("anchors: rule rows and criteria get the ids the server index points to, in LF and CRLF", () => {
  const md = ["| Id | Regra |", "|---|---|", "| RN-calculo-dispensacao-001 | x |", "| ~~RN-calculo-dispensacao-002~~ | y |", "", "- **Critério 3:** z"];
  for (const text of [md.join("\n"), md.join("\r\n")]) {
    const html = render(text);
    assert.match(html, new RegExp(`<tr id="${server.rnAnchor("RN-calculo-dispensacao-001")}">`));
    assert.match(html, new RegExp(`<tr id="${server.rnAnchor("RN-calculo-dispensacao-002")}">`));
    assert.match(html, new RegExp(`<li id="${server.criterionAnchor(3)}">`));
  }
  assert.equal(rnAnchor("RN-a-001"), server.rnAnchor("RN-a-001"));
  assert.equal(criterionAnchor(2), server.criterionAnchor(2));
});

test("render: YAML is a numbered code view with line anchors", () => {
  const { html, title } = renderDocument("a: 1\r\n  CA-443-6:\r\n<b>", { path: "sistema/features/tela/rastreio.yml", paths: PATHS });
  assert.equal(title, "rastreio.yml");
  assert.match(html, /<div class="doc-line" id="L2"><span class="doc-ln">2<\/span><span class="doc-lt">  CA-443-6:<\/span>/);
  assert.match(html, /&lt;b&gt;/);
});

test("paths: joinRelative stays inside doc/ and refuses schemes and absolute paths", () => {
  assert.equal(joinRelative("a/b/c.md", "../d.md"), "a/d.md");
  assert.equal(joinRelative("a/c.md", "./x%20y.md"), "a/x y.md");
  assert.equal(joinRelative("a/c.md", "../../x.md"), null);
  assert.equal(joinRelative("a/c.md", "/etc/x.md"), null);
  assert.equal(joinRelative("a/c.md", "file:x.md"), null);
  assert.equal(resolveWikilink("_status", "sistema/features/tela/regras.md", PATHS), "sistema/features/tela/_status.md", "same folder first");
  assert.equal(resolveWikilink("../x", "a.md", PATHS), null);
  assert.equal(slugify("Olá, mundo!", new Map()), "olá-mundo");
});

test("location: ?doc= in the Harness, #doc/ in the package, both read back", () => {
  assert.deepEqual(parseDocLocation({ search: "?p=x&doc=scrum%2FDIS-443%2Fuser-story.md&docAnchor=criterio-2", hash: "#/layers" }), { path: "scrum/DIS-443/user-story.md", anchor: "criterio-2" });
  setDocsLinkMode("hash");
  const href = docHref("sistema/features/calculo dispensacao/regras.md", "rn-x-001");
  assert.equal(href, "#doc/sistema/features/calculo%20dispensacao/regras.md#rn-x-001");
  assert.deepEqual(parseDocLocation({ hash: href }), { path: "sistema/features/calculo dispensacao/regras.md", anchor: "rn-x-001" });
  setDocsLinkMode("app");
  assert.equal(parseDocLocation({ search: "?p=x", hash: "#/layers" }), null);
});

const REFS = {
  found: true,
  rn: { "RN-calculo-001": { path: "sistema/features/calculo/regras.md", anchor: "rn-calculo-001", text: "Um por chamada", feature: "calculo" }, "RN-tela-001": { path: "t.md", anchor: "rn-tela-001", feature: "tela" } },
  stories: { "DIS-443": { path: "scrum/DIS-443/user-story.md", title: "Integração", criteria: { 2: { anchor: "criterio-2" } } }, "DIS-505": { path: "scrum/DIS-505/user-story.md", title: "Nova prescrição", criteria: {} } },
  aliases: { "DIS-NOVA-PRESCRICAO": "DIS-505" },
  trace: { "PS-31": [{ path: "p.yml", line: 9, feature: "p" }], "CA-443-6": [{ path: "a.yml", line: 1, feature: "a", title: "t" }, { path: "b.yml", line: 2, feature: "b", title: "t" }] },
  features: { tela: { title: "Nova prescrição", docs: { regras: "sistema/features/tela/regras.md" }, stories: [{ id: "DIS-505", role: "principal" }, { id: "DIS-443", role: "secundaria" }] }, calculo: { title: "Cálculo", docs: {}, stories: [] } },
  fieldStories: { s2: { embalagem: { principal: ["DIS-443"], relacionadas: ["DIS-499"] } } },
  missing: [{ screen: "s2", kind: "rn", id: "RN-x-999" }],
};

test("refTarget: each reference kind lands on its document and anchor", () => {
  assert.deepEqual(refTarget(REFS, "rn", "RN-calculo-001"), { type: "doc", path: "sistema/features/calculo/regras.md", anchor: "rn-calculo-001" });
  assert.deepEqual(refTarget(REFS, "story", "DIS-443#2"), { type: "doc", path: "scrum/DIS-443/user-story.md", anchor: "criterio-2" });
  assert.deepEqual(refTarget(REFS, "story", "DIS-NOVA-PRESCRICAO"), { type: "doc", path: "scrum/DIS-505/user-story.md", anchor: "" });
  assert.deepEqual(refTarget(REFS, "trace", "PS-31"), { type: "doc", path: "p.yml", anchor: "L9" });
  assert.equal(refTarget(REFS, "trace", "CA-443-6").type, "choose");
  assert.deepEqual(refTarget(REFS, "feature", "calculo"), { type: "feature", slug: "calculo" });
  assert.deepEqual(refTarget(REFS, "rn", "RN-nao-001"), { type: "missing", kind: "rn", id: "RN-nao-001" });
  assert.equal(refTarget(null, "rn", "RN-calculo-001").type, "missing");
});

test("screen strip: feature, stories from the feature and the fields, features of the cited rules", () => {
  const sc = { id: "s2", feature: "tela", rules: [{ rn: ["RN-calculo-001", "RN-tela-001", "RN-calculo-001"] }] };
  const d = screenDocs(sc, REFS);
  assert.equal(d.feature, "tela");
  assert.deepEqual(d.stories, [["DIS-505", "principal"], ["DIS-443", "secundária"]]);
  assert.deepEqual(d.cited, [["calculo", 2]]);
  assert.equal(d.missing, 1);
  dls.docsRefs = null;
  assert.equal(renderScreenDocsBar(sc), "", "nothing without the index");
  dls.docsRefs = REFS;
  const bar = renderScreenDocsBar(sc);
  assert.match(bar, /Documentação oficial/);
  assert.match(bar, /data-doc-ref="feature" data-doc-id="calculo"/);
  assert.ok(!/onclick=/.test(bar), "chips carry data attributes, not inline code");
  assert.equal(typeof openFromChip, "function", "the chip click handler exists");
});

test("chips: a reference that does not resolve is marked, and ids in the source text become chips", () => {
  dls.docsRefs = REFS;
  assert.match(docChip("rn", "RN-x-999"), /doc-chip-missing/);
  assert.equal(docChip("rn", "x'onmouseover='y"), "", "unsafe ids are not rendered");
  assert.deepEqual(idsInText("DIS-443 · RN-calculo-001 e DIS-NOVA-PRESCRICAO"), { rn: ["RN-calculo-001"], stories: ["DIS-443", "DIS-NOVA-PRESCRICAO"] });
  const chips = renderRuleDocChips({ rn: ["RN-calculo-001"], src: "regras.md · DIS-505" });
  assert.match(chips, /data-doc-id="RN-calculo-001"/);
  assert.match(chips, /data-doc-id="DIS-505"/);
  dls.docsRefs = null;
});

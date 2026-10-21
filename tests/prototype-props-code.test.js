const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-props-code-model.js")).href);
const trace = {
  code: { vanilla: "<div></div>", react18: "<div />", angular18: "<div></div>" },
  codeSource: { react18: "design/ds/components/x/x.jsx", angular18: null },
  files: { screen: "screens/home.html", components: [{ framework: "angular18", path: "design/ds/components/x/x.ts" }] },
  component: { id: "card", isRegistered: true, source: "extracted" },
};

test("pickCode usa a regra local no CSS e o rastreio nas demais abas", async () => {
  const m = await load();
  assert.match(m.pickCode("css", { cls: "px-a", rule: ".px-a {}" }, null).text, /\.px-a \{\}/);
  assert.equal(m.pickCode("css", { cls: "px-a", rule: "" }, null).text, "");
  const withCss = m.pickCode("css", { cls: "px-a", rule: ".px-a {}" }, { css: { matched: ".ds-alert { color: red; }" } }).text;
  assert.ok(withCss.indexOf(".px-a {}") < withCss.indexOf(".ds-alert"));
  assert.equal(m.pickCode("css", { cls: "", rule: "" }, { css: { matched: ".x{}" } }).text, ".x {}");
  assert.equal(m.pickCode("react", { cls: "", rule: "" }, trace).text, "<div />");
  assert.match(m.pickCode("react", { cls: "", rule: "" }, trace).label, /componente x\.jsx/);
  assert.match(m.pickCode("angular", { cls: "", rule: "" }, trace).label, /template do elemento/);
  assert.equal(m.pickCode("angular", { cls: "", rule: "" }, trace).text, "<div></div>");
  assert.match(m.pickCode("html", { cls: "", rule: "" }, trace).label, /screens\/home\.html/);
  assert.equal(m.pickCode("html", { cls: "", rule: "" }, null).text, "");
});

test("fileLines lista componente e arquivos de implementação", async () => {
  const m = await load();
  assert.deepEqual(m.fileLines(null), []);
  const lines = m.fileLines(trace);
  assert.equal(lines[0], "Componente: card (extraído)");
  assert.match(lines[1], /angular18: design\/ds\/components/);
});

test("abas de arquivo do componente: texto, linguagem e lista de arquivos", async () => {
  const m = await load();
  const t = { ...trace, sources: { "design/ds/components/x/x.css": ".a{color:red}" } };
  const pick = m.pickCode("file:design/ds/components/x/x.css", { cls: "", rule: "" }, t);
  assert.equal(pick.text, ".a{color:red}");
  assert.equal(pick.label, "design/ds/components/x/x.css");
  assert.equal(m.pickCode("file:nao/existe.js", { cls: "", rule: "" }, t).text, "");
  assert.equal(m.langOf("file:a/b.css", t), "css");
  assert.equal(m.langOf("file:a/b.html", t), "html");
  assert.equal(m.langOf("file:a/b.component.ts", t), "js");
  assert.equal(m.langOf("angular", { codeSource: { angular18: null } }), "html");
  assert.equal(m.langOf("react", t), "js");
  assert.deepEqual(m.fileEntries(t).map((f) => f.name), ["x.ts"]);
});

test("componentBadge descreve a origem do componente para o rodapé do visualizador", async () => {
  const m = await load();
  assert.equal(m.componentBadge(null), null);
  assert.deepEqual(m.componentBadge(trace), { id: "card", source: "extracted", label: "Componente extraído" });
  assert.equal(m.componentBadge({ component: { id: "dis.x", isRegistered: true } }).source, "ds");
  assert.equal(m.componentBadge({ component: {} }).source, "none");
});

test("activePath e tabOfPath ligam a aba, o arquivo mostrado e o chip destacado", async () => {
  const m = await load();
  const t = { codeSource: { react18: "d/x.jsx", angular18: "d/x.component.ts" } };
  assert.equal(m.activePath("file:d/x.css", t), "d/x.css");
  assert.equal(m.activePath("react", t), "d/x.jsx");
  assert.equal(m.activePath("angular", t), "d/x.component.ts");
  assert.equal(m.activePath("html", t), null);
  assert.equal(m.activePath("react", {}), null);
  assert.equal(m.tabOfPath("d/x.css"), "css");
  assert.equal(m.tabOfPath("d/x.html"), "html");
  assert.equal(m.tabOfPath("d/x.jsx"), "react");
  assert.equal(m.tabOfPath("d/x.component.ts"), "angular");
  assert.equal(m.tabOfPath("d/x.js"), null);
});

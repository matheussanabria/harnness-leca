const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");
const { resolveNodeTraceability } = require("../ui/server/services/prototype-traceability.service");

function makeProject() {
  const projectDir = makeTempDir("trace-mod-", test);
  const protoDir = path.join(projectDir, "design", "prototypes", "demo");
  fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
  fs.mkdirSync(path.join(protoDir, "styles"), { recursive: true });
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({
    id: "demo", activeScreen: "home", screens: [{ id: "home", title: "Home", file: "screens/home.html" }],
  }));
  fs.writeFileSync(path.join(protoDir, "screens", "home.html"),
    '<div data-pid="a1" class="card px-a1"><label for="x" class="lbl">Nome</label></div>');
  fs.writeFileSync(path.join(protoDir, "styles", "proto.css"), ".px-a1 {\n  color: red;\n}\n");
  return projectDir;
}

test("rastreabilidade aceita protótipo modular (telas em arquivos)", () => {
  const t = resolveNodeTraceability(makeProject(), "demo", "home", "a1");
  assert.equal(t.screenId, "home");
  assert.equal(t.files.screen, "screens/home.html");
  assert.equal(t.component.id, "card");
  assert.equal(t.css.className, "px-a1");
  assert.match(t.css.rule, /color: red/);
  assert.ok(!t.code.vanilla.includes("data-pid"));
  assert.match(t.code.react18, /className=/);
  assert.match(t.code.react18, /htmlFor=/);
});

test("rastreabilidade modular: tela inexistente e pid inexistente dão erro claro", () => {
  const dir = makeProject();
  assert.throws(() => resolveNodeTraceability(dir, "demo", "nope", "a1"), /Tela 'nope' não encontrada/);
  assert.throws(() => resolveNodeTraceability(dir, "demo", "home", "zz"), /Elemento 'zz' não encontrado/);
});

function makeDsProject() {
  const projectDir = makeProject();
  const protoDir = path.join(projectDir, "design", "prototypes", "demo");
  fs.writeFileSync(path.join(protoDir, "screens", "home.html"),
    '<div data-pid="a1" class="ds-alert ds-alert--info"><p data-pid="a2">Aviso</p></div><div data-pid="b1" class="caixa">x</div>');
  const proto = JSON.parse(fs.readFileSync(path.join(protoDir, "proto.json"), "utf8"));
  proto.components = [{ id: "alerta", name: "Alerta", screen: "home", pid: "a1", stage: "extracted" }];
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify(proto));
  const dsDir = path.join(projectDir, "design", "ds");
  fs.mkdirSync(path.join(dsDir, "components", "alert"), { recursive: true });
  const impl = { react: { framework: "react", entryFile: "alert.jsx", files: ["alert.jsx"] }, angular: { framework: "angular", entryFile: "alert.component.ts", files: ["alert.component.ts"] } };
  fs.writeFileSync(path.join(dsDir, "registry.json"), JSON.stringify({ components: { "dis.alert": { id: "dis.alert", name: "Alert", implementations: impl } } }));
  fs.writeFileSync(path.join(dsDir, "components", "alert", "manifest.json"), JSON.stringify({ id: "dis.alert", name: "Alert", implementations: impl }));
  fs.writeFileSync(path.join(dsDir, "components.css"), ".ds-alert { color: red; }\n.ds-alert--info { border: 1px solid blue; }\n.fora { color: green; }");
  fs.writeFileSync(path.join(dsDir, "components", "alert", "alert.jsx"), "export const Alert = () => null;");
  fs.writeFileSync(path.join(dsDir, "components", "alert", "alert.component.ts"), "export class AlertComponent {}");
  return projectDir;
}

test("elemento extraído e com classe ds-* é reconhecido como componente do DS, com o código real", () => {
  const t = resolveNodeTraceability(makeDsProject(), "demo", "home", "a1");
  assert.equal(t.component.source, "extracted");
  assert.equal(t.component.id, "dis.alert");
  assert.equal(t.component.name, "Alerta");
  assert.equal(t.component.isRegistered, true);
  assert.equal(t.code.react18, "export const Alert = () => null;");
  assert.match(t.code.angular18, /AlertComponent/);
  assert.match(t.codeSource.react18, /alert\.jsx$/);
  assert.ok(t.code.vanilla.includes("ds-alert"));
  assert.equal(t.sources["design/ds/components/alert/alert.jsx"], "export const Alert = () => null;");
  assert.match(t.css.matched, /design\/ds\/components\.css/);
  assert.match(t.css.matched, /border: 1px solid blue/);
  assert.ok(!t.css.matched.includes("green"));
});

test("elemento sem componente segue com HTML, CSS e código de snippet", () => {
  const t = resolveNodeTraceability(makeDsProject(), "demo", "home", "b1");
  assert.equal(t.component.source, "none");
  assert.equal(t.codeSource.react18, null);
  assert.match(t.code.react18, /className="caixa"/);
});

test("filho de elemento da família ds-* usa só o próprio HTML quando não há classe ds", () => {
  const t = resolveNodeTraceability(makeDsProject(), "demo", "home", "a2");
  assert.equal(t.component.source, "none");
});

test("desfazer componente remove do proto.json e o elemento volta a ser só HTML + CSS", () => {
  const { removeComponentCandidate } = require("../ui/server/services/prototype-structural.service");
  const dir = makeDsProject();
  const res = removeComponentCandidate(dir, "demo", { pid: "a1", screen: "home" });
  assert.deepEqual(res.removed, ["alerta"]);
  const proto = JSON.parse(fs.readFileSync(path.join(dir, "design", "prototypes", "demo", "proto.json"), "utf8"));
  assert.equal(proto.components.length, 0);
  assert.equal(resolveNodeTraceability(dir, "demo", "home", "a1").component.source, "ds");
  assert.throws(() => removeComponentCandidate(dir, "demo", { pid: "a1" }), /não está registrado/);
});

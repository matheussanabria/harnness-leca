// @ts-check
// Classificador de temas (tools/lib/classify.js) e sugestão de grupos (tools/lib/suggest.js): sem modelo e sem rede.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-classify-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => removeDir(TMP_ROOT));

const { classify, classifyRaw, activity, signalNodes } = require("../tools/lib/classify");
const suggest = require("../tools/lib/suggest");

const tool = (name, input) => `:::tool ${name} | x\n--- entrada\n${JSON.stringify(input)}\n--- resultado\nok\n:::`;
const chat = (title, turns) => [
  "---", `titulo: ${JSON.stringify(title)}`, "sessao: s1", 'origem: "x"', "inicio: 2026-10-01T10:00:00Z", "fim: 2026-10-01T11:00:00Z", 'agente: "claude"', "---", "", `# ${title}`, "",
  ...turns.map(([who, text]) => `## ${who}\n\n${text}\n`),
].join("\n");

test("conversa com vários temas recebe vários nós, o mais forte primeiro", () => {
  const raw = chat("Pipeline de deploy", [
    ["Você", "Configura o pipeline do GitHub Actions com build e deploy via docker compose"],
    ["Claude", "Criei o workflow do pipeline com build e o deploy no docker."],
    ["Você", "Agora escreva os testes unitários com mock para o service"],
  ]);
  const ids = classifyRaw(raw).map((h) => h.id);
  assert.ok(ids.includes("entrega/cicd"), ids.join());
  assert.ok(ids.includes("entrega/infra"), ids.join());
  assert.ok(ids.includes("qualidade/testes"), ids.join());
  assert.equal(ids[0], "entrega/cicd");
});

test("ignora acentos e só casa palavra inteira", () => {
  assert.ok(classify({ title: "Autenticação com Keycloak e JWT" }).some((h) => h.id === "backend/auth"));
  // "apis" não contém "api" como palavra inteira em "capitao"; "tela" não casa dentro de "estela"
  assert.equal(classify({ title: "capitao estela" }).length, 0);
});

test("sinais de atividade (comandos e arquivos) viram temas mesmo sem a palavra no texto", () => {
  const body = [
    tool("Bash", { command: "git commit -m x" }),
    tool("Edit", { file_path: "C:\\proj\\src\\app\\paciente.spec.ts" }),
    tool("Skill", { skill: "sdlc-pipeline" }),
  ].join("\n\n");
  const a = activity(body);
  assert.deepEqual([...a.skills], ["sdlc-pipeline"]);
  assert.deepEqual(a.files, ["C:/proj/src/app/paciente.spec.ts"]);
  const ids = [...signalNodes(a).keys()];
  assert.ok(ids.includes("entrega/git") && ids.includes("qualidade/testes") && ids.includes("ia/agentes"), ids.join());
  const hits = classify({ title: "ajuste", rest: "ok", activityBody: body });
  assert.ok(hits.find((h) => h.id === "entrega/git" && h.signal));
});

test("Edit em arquivo não conta como comando e leitura não conta como edição", () => {
  const a = activity(tool("Read", { file_path: "src/a.scss" }));
  assert.deepEqual(a.files, []);
});

test("sem nenhum tema reconhecido cai em Geral", () => {
  const s = suggest.suggestGroupByHeuristic({ name: "x.md", title: "bom dia", text: "tudo bem?" }, []);
  assert.equal(s.group, "Geral");
  assert.deepEqual(s.tags, []);
});

test("reaproveita o grupo que o projeto já tem (nome antigo) em vez de criar um novo", () => {
  const groups = [{ id: "grp_1", name: "Dispensação & Medicamentos", color: "#3cb371", subgroups: [] }];
  const s = suggest.suggestGroupByHeuristic({ name: "x.md", title: "Fluxo do paciente e posologia da receita", text: "" }, groups);
  assert.equal(s.groupId, "grp_1");
  assert.equal(s.group, "Dispensação & Medicamentos");
  assert.equal(s.color, "#3cb371");
});

test("sem grupo existente propõe o pai da árvore, com o nó como subgrupo e as demais tags", () => {
  const raw = chat("Erro 500 no endpoint", [["Você", "O endpoint do controller retorna erro 500, corrige o bug na api"], ["Claude", "Corrigi o controller."]]);
  const s = suggest.suggestGroupByHeuristic({ name: "x.md", title: "Erro 500 no endpoint", raw }, []);
  assert.equal(s.groupId, undefined);
  assert.ok(s.group && s.subgroup);
  assert.ok(s.tags.length >= 2);
  assert.match(s.reason, /Tema principal/);
});

test("classifyProject só sugere para conversas sem grupo e não grava nada", async () => {
  const dir = path.join(TMP_ROOT, "projects", "p1");
  fs.mkdirSync(path.join(dir, "chats"), { recursive: true });
  fs.writeFileSync(path.join(dir, "chats", "a.md"), chat("Docker compose", [["Você", "sobe o docker compose"], ["Claude", "feito"]]));
  fs.writeFileSync(path.join(dir, "chats", "b.md"), chat("Testes", [["Você", "escreva testes unitários"], ["Claude", "feito"]]));
  fs.writeFileSync(path.join(dir, "groups.json"), JSON.stringify({ groups: [{ id: "g", name: "X", subgroups: [] }], assignments: { "b.md": { groupId: "g", group: "X", subgroup: "" } } }));
  const before = fs.readFileSync(path.join(dir, "groups.json"), "utf8");
  const r = await suggest.classifyProject("p1");
  assert.equal(r.total, 2);
  assert.equal(r.pending, 1);
  assert.equal(r.suggestions[0].file, "a.md");
  assert.equal(fs.readFileSync(path.join(dir, "groups.json"), "utf8"), before);
  assert.equal((await suggest.classifyProject("p1", { all: true })).pending, 2);
});

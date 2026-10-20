// @ts-check
// Testes unitários para o gerenciador de Skills (.agents/skills) e suas rotas na UI.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-skills-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const projDir = path.join(TMP_ROOT, "projects", "proj-test");
const repoBase = path.join(TMP_ROOT, "mock-repo");
const subWeb = path.join(repoBase, "dispensacao-web");
const subApi = path.join(repoBase, "dispensacao-api");

// Configura estrutura de teste
fs.mkdirSync(projDir, { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "proj-test\n");
fs.writeFileSync(path.join(projDir, "instructions.md"), "# instrucoes\n");
fs.writeFileSync(path.join(projDir, "memory.md"), "- memoria\n");
fs.mkdirSync(path.join(projDir, "chats"), { recursive: true });
fs.mkdirSync(path.join(projDir, "context"), { recursive: true });

// Configura repo simulado com web e api
fs.mkdirSync(path.join(subWeb, ".agents", "skills", "anti-patterns"), { recursive: true });
fs.writeFileSync(
  path.join(subWeb, ".agents", "skills", "anti-patterns", "SKILL.md"),
  `---
name: anti-patterns
description: Anti-patterns no Angular
version: 1.0.0
---
# Anti-patterns

Evitar vazamentos RxJS.
`
);

fs.mkdirSync(path.join(subApi, ".agents", "skills", "boas-praticas"), { recursive: true });
fs.writeFileSync(path.join(subApi, "pom.xml"), "<project></project>");
fs.writeFileSync(path.join(subWeb, "package.json"), "{}");

// Conecta repo ao projeto via mcp.json
fs.writeFileSync(
  path.join(projDir, "mcp.json"),
  JSON.stringify({ repo: repoBase }, null, 2)
);

const skillsLib = require("../tools/lib/skills");
const { createServer } = require("../ui/server");

let server;
/** @type {string} */
let base = "";
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.closeAllConnections();
  server.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const get = (p) => fetch(base + p);
const post = (p, body) => fetch(base + p, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify(body),
});
const del = (p, body) => fetch(base + p, {
  method: "DELETE",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify(body),
});

test("skillsLib: descobre alvos do projeto corretamente", () => {
  const targets = skillsLib.findProjectTargets("proj-test");
  const ids = targets.map((t) => t.id);
  assert.ok(ids.includes("dispensacao-web"), "deve incluir dispensacao-web");
  assert.ok(ids.includes("dispensacao-api"), "deve incluir dispensacao-api");
  assert.ok(ids.includes("project-harness"), "deve incluir o projeto harness");
});

test("skillsLib: lista skills existentes e diferencia completas de rascunhos", () => {
  const res = skillsLib.listProjectSkills("proj-test");
  assert.ok(Array.isArray(res.skills));
  const webSkill = res.skills.find((s) => s.name === "anti-patterns");
  assert.ok(webSkill, "skill anti-patterns deve ser encontrada");
  assert.equal(webSkill.hasSkillMd, true);
  assert.equal(webSkill.version, "1.0.0");
  assert.match(webSkill.description, /Anti-patterns no Angular/);

  const apiSkill = res.skills.find((s) => s.name === "boas-praticas");
  assert.ok(apiSkill, "skill boas-praticas deve ser encontrada");
  assert.equal(apiSkill.hasSkillMd, false, "deve ser rascunho pois não tem SKILL.md ainda");
});

test("skillsLib: salva, lê detalhes e remove uma skill", () => {
  // Salva nova skill
  const saved = skillsLib.saveSkill("proj-test", "dispensacao-api", "regras-faturamento", {
    frontmatter: {
      name: "regras-faturamento",
      description: "Regras de negócio de faturamento hospitalar",
      version: "1.2.0",
    },
    content: "# Regras de Faturamento\n\nDiretrizes de cálculo.\n",
    references: [
      { name: "tabela-precos.md", content: "# Tabela de Preços\n" },
    ],
  });

  assert.equal(saved.name, "regras-faturamento");
  assert.equal(saved.hasSkillMd, true);
  assert.equal(saved.references.length, 1);
  assert.equal(saved.references[0].name, "tabela-precos.md");

  // Lê detalhes
  const detail = skillsLib.getSkillDetail("proj-test", "dispensacao-api", "regras-faturamento");
  assert.ok(detail);
  assert.equal(detail.frontmatter.name, "regras-faturamento");
  assert.equal(detail.frontmatter.version, "1.2.0");

  // Remove skill
  const deleted = skillsLib.deleteSkill("proj-test", "dispensacao-api", "regras-faturamento");
  assert.equal(deleted, true);

  const detailAfter = skillsLib.getSkillDetail("proj-test", "dispensacao-api", "regras-faturamento");
  assert.equal(detailAfter, null);
});

test("skillsLib: instala pacote de templates com sucesso", () => {
  const result = skillsLib.installTemplate("proj-test", "dispensacao-api", "bundle:api");
  assert.equal(result.ok, true);
  assert.ok(result.installed.includes("boas-praticas"));
  assert.ok(result.installed.includes("anti-patterns"));
  assert.ok(result.installed.includes("infra-qualidade"));
  assert.ok(result.installed.includes("padroes-codigo"));

  const list = skillsLib.listProjectSkills("proj-test");
  const apiSkills = list.skills.filter((s) => s.targetId === "dispensacao-api");
  assert.equal(apiSkills.length >= 4, true);
  assert.ok(apiSkills.every((s) => s.hasSkillMd));
});

test("HTTP API: rotas de skills funcionam perfeitamente no servidor", async () => {
  // GET /api/project/:slug/skills
  const resList = await get("/api/project/proj-test/skills");
  assert.equal(resList.status, 200);
  const dataList = await resList.json();
  assert.ok(Array.isArray(dataList.skills));

  // GET /api/project/:slug/skills/templates
  const resTemplates = await get("/api/project/proj-test/skills/templates");
  assert.equal(resTemplates.status, 200);
  const templates = await resTemplates.json();
  assert.ok(Array.isArray(templates.web));
  assert.ok(Array.isArray(templates.api));

  // POST /api/project/:slug/skills (criação)
  const resCreate = await post("/api/project/proj-test/skills", {
    targetId: "dispensacao-web",
    name: "nova-skill-http",
    frontmatter: {
      name: "nova-skill-http",
      description: "Skill criada via API HTTP",
      version: "1.0.0",
    },
    content: "# Nova Skill HTTP\n",
  });
  assert.equal(resCreate.status, 200);
  const created = await resCreate.json();
  assert.equal(created.ok, true);
  assert.equal(created.skill.name, "nova-skill-http");

  // GET /api/project/:slug/skills/detail
  const resDetail = await get("/api/project/proj-test/skills/detail?target=dispensacao-web&name=nova-skill-http");
  assert.equal(resDetail.status, 200);
  const detail = await resDetail.json();
  assert.equal(detail.name, "nova-skill-http");
  assert.equal(detail.frontmatter.description, "Skill criada via API HTTP");

  // POST /api/project/:slug/skills/delete
  const resDel = await post("/api/project/proj-test/skills/delete", {
    targetId: "dispensacao-web",
    name: "nova-skill-http",
  });
  assert.equal(resDel.status, 200);
  const delData = await resDel.json();
  assert.equal(delData.ok, true);
});

test("skillsLib: listRecognizedSkills e importRecognizedSkill funcionam e importam referências completas", async () => {
  const recognized = skillsLib.listRecognizedSkills("proj-test");
  assert.ok(Array.isArray(recognized));
  // Deve encontrar skills globais ou do harness
  assert.ok(recognized.length > 0, "deve encontrar skills reconhecidas no ambiente");
  assert.ok(recognized.some((s) => s.hasSkillMd), "skills reconhecidas devem conter SKILL.md");

  // Cria um diretório temporário simulando uma skill reconhecida externa com referências
  const dummyRecognizedDir = path.join(TMP_ROOT, "dummy-recognized-skill");
  fs.mkdirSync(path.join(dummyRecognizedDir, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(dummyRecognizedDir, "SKILL.md"),
    "---\nname: dummy-recognized\ndescription: Skill de teste reconhecida\nversion: 2.1.0\n---\n# Dummy Recognized\n\nConteúdo completo da skill.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dummyRecognizedDir, "references", "extra-doc.md"),
    "# Conteúdo completo da referência importada\n",
    "utf8"
  );

  // Importa a skill reconhecida para o target dispensacao-api
  const resImport = skillsLib.importRecognizedSkill("proj-test", "dispensacao-api", "dummy-recognized", dummyRecognizedDir);
  assert.equal(resImport.ok, true);
  assert.ok(resImport.skill, "resImport.skill deve existir");
  assert.equal(resImport.skill.name, "dummy-recognized");
  assert.equal(/** @type {any} */ (resImport.skill.frontmatter).version, "2.1.0");
  assert.equal(resImport.skill.references.length, 1);
  assert.equal(resImport.skill.references[0].name, "extra-doc.md");
  assert.match(resImport.skill.references[0].content, /Conteúdo completo da referência/);

  // Testa rota HTTP GET /api/project/:slug/skills/recognized
  const httpRec = await get("/api/project/proj-test/skills/recognized");
  assert.equal(httpRec.status, 200);
  const recData = await httpRec.json();
  assert.ok(Array.isArray(recData));

  // Testa rota HTTP POST /api/project/:slug/skills/import-recognized
  const httpPostRec = await post("/api/project/proj-test/skills/import-recognized", {
    targetId: "dispensacao-web",
    skillName: "dummy-recognized-web",
    sourcePath: dummyRecognizedDir,
  });
  assert.equal(httpPostRec.status, 200);
  const postRecData = await httpPostRec.json();
  assert.equal(postRecData.ok, true);
  assert.equal(postRecData.skill.name, "dummy-recognized-web");
});


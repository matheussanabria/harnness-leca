// Revisão das sugestões de memória: leitura do extraido-memorias.md, filtros e aplicação das decisões.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mem-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const MR = require("../tools/lib/memory-review");

const SAMPLE = `# Memórias, regras e decisões sugeridas

Sugestões para revisão.

<!-- sessao: aaa | 2026-10-14 -->
## Primeira conversa (2026-10-14)

## Memórias
- O MCP do design system é o cod-design-system.
- A API roda na porta 8080, atrás do proxy
  da empresa.

## Regras e preferências
- Sempre responder em português.

## Decisões
- Usar SQLite: já vem no Node.

## Termos do domínio
- DIS: Design system de dispensação.

<!-- sessao: bbb | 2026-10-15 -->
## Segunda conversa (2026-10-15)

## Memórias
- O MCP do design system é o \`cod-design-system\`.
- Contato: ana@exemplo.com, token=abcdef123456.
`;

function project(t, name, { suggestions = SAMPLE, memory } = {}) {
  const dir = path.join(TMP_ROOT, "projects", name);
  fs.mkdirSync(path.join(dir, "context"), { recursive: true });
  if (suggestions != null) fs.writeFileSync(path.join(dir, "context", "extraido-memorias.md"), suggestions);
  if (memory != null) fs.writeFileSync(path.join(dir, "memory.md"), memory);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, memory: path.join(dir, "memory.md"), review: path.join(dir, "memory-review.json") };
}

test("parseSuggestions: categorias, origem, continuação de linha e repetição entre conversas", () => {
  const s = MR.parseSuggestions(SAMPLE);
  const by = (cat) => s.filter((x) => x.categoria === cat).map((x) => x.texto);

  assert.deepEqual(by("memoria").slice(0, 2), ["O MCP do design system é o cod-design-system.", "A API roda na porta 8080, atrás do proxy da empresa."]);
  assert.deepEqual(by("regra"), ["Sempre responder em português."]);
  assert.deepEqual(by("decisao"), ["Usar SQLite: já vem no Node."]);
  assert.deepEqual(by("termo"), ["DIS: Design system de dispensação."]);

  // O mesmo fato escrito com e sem crases nas duas conversas é uma sugestão só, com as duas origens.
  const mcp = s.find((x) => x.texto.startsWith("O MCP"));
  assert.deepEqual(mcp.conversas.map((c) => [c.titulo, c.data, c.sessao]), [["Primeira conversa", "2026-10-14", "aaa"], ["Segunda conversa", "2026-10-15", "bbb"]]);
  assert.equal(s.filter((x) => x.texto.startsWith("O MCP")).length, 1);

  // Dados pessoais e segredos já saem redigidos da sugestão.
  const contato = s.find((x) => x.texto.startsWith("Contato"));
  assert.ok(!contato.texto.includes("ana@exemplo.com") && !contato.texto.includes("abcdef123456"), contato.texto);
});

test("parseSuggestions: arquivo antigo sem marcador de sessão e arquivo vazio", () => {
  const old = "# Sugestões\n\n## Extrair artefatos no projeto DAI (2026-10-14)\n\n## Memórias\n- Fato antigo.\n\n## Decisões\n- Decisão antiga.\n";
  const s = MR.parseSuggestions(old);
  assert.deepEqual(s.map((x) => [x.categoria, x.texto, x.conversas[0].titulo, x.conversas[0].data]),
    [["memoria", "Fato antigo.", "Extrair artefatos no projeto DAI", "2026-10-14"], ["decisao", "Decisão antiga.", "Extrair artefatos no projeto DAI", "2026-10-14"]]);
  assert.deepEqual(MR.parseSuggestions(""), []);
});

test("pending: some o que já está na memory.md (com ou sem data e prefixo), o promovido e o descartado", (t) => {
  const p = project(t, "p-pend", { memory: "# Memória\n\n- [2026-01-01] O MCP do design system é o cod-design-system.\n- [2026-01-02] Regra: Sempre responder em português.\n" });
  const texts = MR.pending("p-pend").map((s) => s.texto);
  assert.ok(!texts.some((x) => x.startsWith("O MCP")), "já está na memória");
  assert.ok(!texts.includes("Sempre responder em português."), "já está na memória com o prefixo 'Regra: '");
  assert.ok(texts.includes("Usar SQLite: já vem no Node."));
  assert.ok(!fs.existsSync(p.review));
});

test("apply: promover grava na memory.md (com data e prefixo), descartar só registra, e nada volta a aparecer", (t) => {
  const p = project(t, "p-apply", { memory: "# Memória do projeto\n<!-- comentário -->\n\n- [2026-01-01] Fato que já existia.\n" });
  const [memoria, regra, decisao, termo] = ["memoria", "regra", "decisao", "termo"].map((c) => MR.pending("p-apply").find((s) => s.categoria === c));

  const r = MR.apply("p-apply", [
    { id: memoria.id, acao: "promover" },
    { id: regra.id, acao: "promover", texto: "  Sempre responder em português do Brasil.  " }, // editada
    { id: decisao.id, acao: "descartar" },
    { id: termo.id, acao: "promover" },
    { id: "inexistente", acao: "promover" },
    { id: memoria.id, acao: "promover" }, // repetida na mesma chamada
  ], new Date("2026-10-15T12:00:00Z"));
  assert.deepEqual([r.promovidas, r.descartadas, r.ignoradas.length], [3, 1, 2]);

  const mem = fs.readFileSync(p.memory, "utf8");
  assert.match(mem, /^- \[2026-01-01\] Fato que já existia\.$/m, "o que já existia fica como estava");
  assert.match(mem, /^- \[2026-10-15\] O MCP do design system é o cod-design-system\.$/m);
  assert.match(mem, /^- \[2026-10-15\] Regra: Sempre responder em português do Brasil\.$/m, "texto editado + prefixo da categoria");
  assert.match(mem, /^- \[2026-10-15\] Termo: DIS: Design system de dispensação\.$/m);
  assert.ok(!mem.includes("SQLite"), "descartada não vai para a memória");
  assert.equal(mem.match(/O MCP do design system/g).length, 1, "não grava duas vezes");

  const review = JSON.parse(fs.readFileSync(p.review, "utf8")).itens;
  assert.deepEqual(Object.values(review).map((x) => x.acao).sort(), ["descartada", "promovida", "promovida", "promovida"]);

  const left = MR.pending("p-apply").map((s) => s.texto);
  assert.ok(!left.includes("Usar SQLite: já vem no Node."), "descartada não volta");
  assert.ok(!left.includes("Sempre responder em português."), "promovida (editada) não volta com o texto original");

  // Reanalisar a conversa regera as mesmas sugestões: o que foi revisado continua escondido.
  fs.writeFileSync(path.join(p.dir, "context", "extraido-memorias.md"), SAMPLE + "\n<!-- sessao: ccc | 2026-10-16 -->\n## Terceira (2026-10-16)\n\n## Decisões\n- Usar SQLite: já vem no Node.\n- Decisão realmente nova.\n");
  assert.deepEqual(MR.pending("p-apply").filter((s) => s.categoria === "decisao").map((s) => s.texto), ["Decisão realmente nova."]);
});

test("apply: texto editado passa por redact, vira uma linha só e tem limite; memory.md ausente é criada", (t) => {
  const p = project(t, "p-clean");
  const s = MR.pending("p-clean")[0];
  MR.apply("p-clean", [{ id: s.id, acao: "promover", texto: "linha 1\nlinha 2 com ana@exemplo.com e token=abcdef123456\n\n- [2026-01-01] " + "x".repeat(900) }]);
  const mem = fs.readFileSync(p.memory, "utf8");
  const line = mem.split("\n").find((l) => l.includes("linha 1"));
  assert.ok(line.startsWith("- ["), line.slice(0, 20));
  assert.ok(!line.includes("ana@exemplo.com") && !line.includes("abcdef123456"), "redigido");
  assert.ok(line.length < 700, `limitada: ${line.length}`);
  assert.match(mem, /^# Memória do projeto/, "memory.md criada com o cabeçalho padrão");
  assert.equal(mem.split("\n").filter((l) => l.startsWith("- [")).length, 1);
});

test("apply: valida o formato e o limite de ações; sem sugestões não quebra", (t) => {
  project(t, "p-limits", { suggestions: null });
  assert.deepEqual(MR.pending("p-limits"), []);
  assert.throws(() => MR.apply("p-limits", "x"), MR.ReviewError);
  assert.throws(() => MR.apply("p-limits", Array.from({ length: MR.MAX_ACTIONS + 1 }, () => ({}))), MR.ReviewError);
  assert.deepEqual(MR.apply("p-limits", [null, {}, { id: "x", acao: "apagar" }]).ignoradas.length, 3);
  assert.throws(() => MR.pending("../fora"), /projeto inválido/);
});

test("migrated: promoção cria item atômico em memory/ e regenera memory.md como índice determinístico", (t) => {
  const p = project(t, "p-migrated");
  // Cria pasta memory/ para marcar como migrado
  fs.mkdirSync(path.join(p.dir, "memory"), { recursive: true });

  const pendentes = MR.pending("p-migrated");
  assert.ok(pendentes.length > 0);
  const s = pendentes.find((x) => x.categoria === "regra");
  assert.ok(s);

  const r = MR.apply("p-migrated", [{ id: s.id, acao: "promover" }], new Date("2026-10-26T12:00:00Z"));
  assert.equal(r.promovidas, 1);

  // memory.md NÃO deve conter bullets legados "- [AAAA-MM-DD] Regra: ..."
  const mem = fs.readFileSync(p.memory, "utf8");
  assert.ok(!mem.includes("- [2026-10-26] Regra:"), "não deve gravar bullet legado");
  assert.match(mem, /^# Memória do projeto p-migrated/, "regenerou índice");

  // Arquivo do item deve ter sido gravado em memory/feedback/<name>.md
  const feedbackDir = path.join(p.dir, "memory", "feedback");
  assert.ok(fs.existsSync(feedbackDir), "criou pasta feedback/");
  const filesInDir = fs.readdirSync(feedbackDir);
  assert.equal(filesInDir.length, 1);
  const itemContent = fs.readFileSync(path.join(feedbackDir, filesInDir[0]), "utf8");
  assert.match(itemContent, /^---/m);
  assert.match(itemContent, /type: feedback/);
  assert.match(itemContent, /source: review:/);
  assert.match(itemContent, /\*\*Why:\*\*/);
});

test("migrated: sugestão igual ou similar a item existente em memory/ não volta na fila de pendentes", (t) => {
  const p = project(t, "p-migrated-dedup");
  const memDir = path.join(p.dir, "memory", "reference");
  fs.mkdirSync(memDir, { recursive: true });

  const { serializeItem } = require("../tools/lib/memory/item");
  const itemContent = serializeItem({
    name: "mcp-design-system",
    description: "O MCP do design system é o cod-design-system.",
    type: "reference",
    created: "2026-10-01",
    updated: "2026-10-01",
    source: "manual",
  }, "");
  fs.writeFileSync(path.join(memDir, "mcp-design-system.md"), itemContent, "utf8");

  const pendentes = MR.pending("p-migrated-dedup");
  const texts = pendentes.map((x) => x.texto);
  assert.ok(!texts.some((txt) => txt.includes("cod-design-system")), "item já existente em memory/ não deve aparecer como pendente");
});

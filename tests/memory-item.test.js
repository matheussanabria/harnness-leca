// Contrato do item de memória (EP-13.02): parse, serialização, normalização, hash, slugify e validação.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const item = require("../tools/lib/memory/item");

const DESC = "Remover arquivo, pasta ou dado só com confirmação explícita no chat";
const CORPO = [
  "Ações destrutivas nunca rodam sem pedir permissão e receber confirmação.",
  "**Why:** o usuário perdeu arquivos de um projeto em 2026-10-14.",
  '**How to apply:** listar com precisão o que será removido e esperar o "sim".',
  "Relacionado: [[icones-fontawesome]]",
].join("\n");

// Item canônico: frontmatter na ordem fixa, sem comentário, com o hash do contrato.
const CANONICO = [
  "---",
  "name: acoes-destrutivas-pedem-confirmacao",
  `description: ${DESC}`,
  "type: feedback",
  "created: 2026-10-14",
  "updated: 2026-10-19",
  "source: chat:2026-10-14-limpeza-projetos",
  "hash: 843fb15d",
  "---",
  CORPO,
  "",
].join("\n");

// Meta com o hash recalculado para um corpo qualquer (o hash é sempre do description + corpo).
const comHash = (meta, body) => ({ ...meta, hash: item.hashOf(meta.description, body) });

test("parseItem: devolve meta e body de um item válido", () => {
  const lido = item.parseItem(CANONICO);
  assert.ok(!Array.isArray(lido), "item válido não devolve lista de erros");
  assert.deepEqual(lido.meta, {
    name: "acoes-destrutivas-pedem-confirmacao",
    description: DESC,
    type: "feedback",
    created: "2026-10-14",
    updated: "2026-10-19",
    source: "chat:2026-10-14-limpeza-projetos",
    hash: "843fb15d",
  });
  assert.equal(lido.body, CORPO);
});

test("parseItem: o comentário depois do valor é ignorado na leitura", () => {
  const comComentario = CANONICO
    .replace("type: feedback", "type: feedback            # user | feedback | project | reference")
    .replace("hash: 843fb15d", "hash: 843fb15d            # sha1 curto do texto normalizado");
  const lido = item.parseItem(comComentario);
  assert.ok(!Array.isArray(lido), JSON.stringify(lido));
  assert.equal(lido.meta.type, "feedback");
  assert.equal(lido.meta.hash, "843fb15d");
  assert.equal(lido.meta.description, DESC);
});

test("ida e volta: serializeItem(parseItem(x)) === x", () => {
  const lido = item.parseItem(CANONICO);
  assert.ok(!Array.isArray(lido));
  assert.equal(item.serializeItem(lido.meta, lido.body), CANONICO);

  // O mesmo para um item de outro tipo, sem os blocos Why/How to apply.
  const outro = item.serializeItem(
    { name: "fase-nomeia-o-slug", description: "O nome da fase vem antes do slug", type: "user", created: "2026-10-01", updated: "2026-10-02", source: "manual" },
    "Fato curto.\n"
  );
  const lidoOutro = item.parseItem(outro);
  assert.ok(!Array.isArray(lidoOutro), JSON.stringify(lidoOutro));
  assert.equal(item.serializeItem(lidoOutro.meta, lidoOutro.body), outro);
});

test("serializeItem: escreve os campos na ordem fixa e recalcula o hash", () => {
  const meta = { name: "fase-nomeia-o-slug", description: "O nome da fase vem antes do slug", type: "user", created: "2026-10-01", updated: "2026-10-02", source: "manual", hash: "hash-velho" };
  const linhas = item.serializeItem(meta, "Fato curto.\n").split("\n");
  assert.deepEqual(linhas.slice(0, 9), [
    "---",
    "name: fase-nomeia-o-slug",
    "description: O nome da fase vem antes do slug",
    "type: user",
    "created: 2026-10-01",
    "updated: 2026-10-02",
    "source: manual",
    `hash: ${item.hashOf(meta.description, "Fato curto.")}`,
    "---",
  ]);
  assert.equal(linhas[9], "Fato curto.");
  assert.equal(linhas[10], "");
});

test("hash: 8 primeiros caracteres do sha1 do texto normalizado de description + corpo", () => {
  const esperado = crypto.createHash("sha1").update("acao\ncorpo", "utf8").digest("hex").slice(0, 8);
  assert.equal(item.hashOf("Ação.", "Corpo."), esperado);
  assert.equal(item.hashOf("Ação.", "Corpo.").length, 8);
  assert.equal(item.hashOf(DESC, CORPO), "843fb15d");
});

test("hash: igual para textos que só diferem em acento, caixa, espaço e pontuação final", () => {
  const base = item.hashOf(DESC, CORPO);
  const variantes = [
    ["sem acento", DESC.replace("só", "so").replace("confirmação", "confirmacao"), CORPO.replace("Ações", "Acoes").replace("precisão", "precisao")],
    ["caixa alta", DESC.toUpperCase(), CORPO.toUpperCase()],
    ["espaço a mais", DESC.replace("arquivo,", "arquivo,   "), CORPO.replace("nunca", "nunca  ")],
    ["pontuação final", `${DESC}.`, `${CORPO}.`],
    ["outra data", DESC, CORPO.replace("2026-10-14", "2026-11-02")],
  ];
  for (const [rotulo, d, c] of variantes) assert.equal(item.hashOf(d, c), base, `variante "${rotulo}" mudou o hash`);
});

test("normalize: minúsculas, sem acento, espaços colapsados, sem datas e sem pontuação final", () => {
  assert.equal(item.normalize("Ações  DESTRUTIVAS."), "acoes destrutivas");
  assert.equal(item.normalize("Fato em 2026-10-14."), "fato em");
  assert.equal(item.normalize("  espaço nas bordas  "), "espaco nas bordas");
  assert.equal(item.normalize(""), "");
});

test("slugify: gera nome kebab-case a partir de uma frase", () => {
  assert.equal(item.slugify("Ações destrutivas pedem confirmação"), "acoes-destrutivas-pedem-confirmacao");
  assert.equal(item.slugify("  CamelCase  e  pontuação!  "), "camelcase-e-pontuacao");
  assert.equal(item.slugify(""), "");
});

test("validate: item válido não devolve erro", () => {
  const lido = item.parseItem(CANONICO);
  assert.ok(!Array.isArray(lido));
  assert.deepEqual(item.validate(lido.meta, lido.body), []);
});

// Cada regra do contrato (RF4) tem de recusar o caso inválido.
const CASOS = [
  { nome: "name ausente", campo: "name", muda: (m) => { m.name = ""; } },
  { nome: "name fora do kebab-case", campo: "name", muda: (m) => { m.name = "Acoes Destrutivas"; } },
  { nome: "description ausente", campo: "description", muda: (m) => { m.description = ""; } },
  { nome: "description com mais de 140 caracteres", campo: "description", muda: (m) => { m.description = "x".repeat(141); } },
  { nome: "description com duas linhas", campo: "description", muda: (m) => { m.description = "uma linha\noutra linha"; } },
  { nome: "type ausente", campo: "type", muda: (m) => { m.type = ""; } },
  { nome: "type fora dos quatro", campo: "type", muda: (m) => { m.type = "nota"; } },
  { nome: "created ausente", campo: "created", muda: (m) => { m.created = ""; } },
  { nome: "created fora do formato AAAA-MM-DD", campo: "created", muda: (m) => { m.created = "14/10/2026"; } },
  { nome: "updated que não existe no calendário", campo: "updated", muda: (m) => { m.updated = "2026-13-45"; } },
  { nome: "source ausente", campo: "source", muda: (m) => { m.source = ""; } },
  { nome: "hash ausente", campo: "hash", muda: (m) => { m.hash = ""; } },
  { nome: "hash que não confere com o corpo", campo: "hash", muda: (m) => { m.hash = "00000000"; } },
];

for (const caso of CASOS) {
  test(`validate: recusa ${caso.nome}`, () => {
    const base = { ...item.parseItem(CANONICO).meta };
    caso.muda(base);
    const erros = item.validate(base, CORPO);
    assert.ok(Array.isArray(erros), "validate devolve lista de erros");
    assert.ok(erros.some((e) => e.campo === caso.campo), `faltou o erro em ${caso.campo}: ${JSON.stringify(erros)}`);
  });
}

test("validate: feedback e project exigem **Why:** e **How to apply:**", () => {
  const base = { ...item.parseItem(CANONICO).meta };
  const semWhy = CORPO.replace("**Why:** o usuário perdeu arquivos de um projeto em 2026-10-14.", "Porque importa.");
  const semHow = CORPO.replace('**How to apply:** listar com precisão o que será removido e esperar o "sim".', "Assim: listar e esperar.");

  assert.ok(item.validate(base, semWhy).some((e) => e.campo === "body"), "falta o **Why:**");
  assert.ok(item.validate(base, semHow).some((e) => e.campo === "body"), "falta o **How to apply:**");

  const comoProject = { ...base, type: "project" };
  assert.ok(item.validate(comoProject, semWhy).some((e) => e.campo === "body"), "project também exige os dois blocos");

  // user e reference não exigem os dois blocos.
  for (const tipo of ["user", "reference"]) {
    const curto = "Um fato curto.";
    const meta = comHash({ ...base, type: tipo }, curto);
    assert.deepEqual(item.validate(meta, curto), [], `tipo ${tipo} não devia exigir os blocos`);
  }
});

test("parseItem: item inválido devolve a lista de erros de contrato", () => {
  const erros = item.parseItem(CANONICO.replace("type: feedback", "type: nota"));
  assert.ok(Array.isArray(erros), "devolve lista, não lança");
  assert.ok(erros.some((e) => e.campo === "type"), JSON.stringify(erros));

  const semBloco = item.parseItem("name: x\n");
  assert.ok(Array.isArray(semBloco) && semBloco.some((e) => e.campo === "frontmatter"), "frontmatter ausente");

  const campoDesconhecido = item.parseItem(CANONICO.replace("type: feedback", "tipo: feedback"));
  assert.ok(Array.isArray(campoDesconhecido) && campoDesconhecido.some((e) => e.campo === "frontmatter"), "campo desconhecido");
});

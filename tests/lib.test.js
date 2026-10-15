// Módulos pequenos de tools/lib usados por vários scripts.
const test = require("node:test");
const assert = require("node:assert/strict");

const { slugify, clip, safe } = require("../tools/lib/text");
const { flag, opt } = require("../tools/lib/cli");
const { MAX_IO } = require("../tools/lib/limits");

test("slugify: minúsculas, sem acento, só [a-z0-9-], até 60 caracteres", () => {
  assert.equal(slugify("Olá, Mundo! Ação nº 1"), "ola-mundo-acao-n-1");
  assert.equal(slugify("--já--"), "ja");
  assert.equal(slugify(""), "sem-titulo");
  assert.equal(slugify(null), "sem-titulo");
  assert.equal(slugify(undefined), "sem-titulo");
  assert.equal(slugify("!!!"), "sem-titulo");
  assert.equal(slugify("a".repeat(100)).length, 60);
  assert.equal(slugify(12345), "12345");
});

test("clip: corta acima de MAX_IO avisando quantos caracteres sobraram", () => {
  assert.equal(clip("  curto  "), "curto");
  assert.equal(clip(null), "");
  const long = "x".repeat(MAX_IO + 25);
  const out = clip(long);
  assert.ok(out.startsWith("x".repeat(MAX_IO)));
  assert.match(out, /… \(\+25 caracteres\)$/);
});

test("safe: desarma linhas ::: no início, sem mexer em ::: no meio da linha", () => {
  const out = safe("a\n:::fim\nb :::c\n:::");
  assert.ok(!/^:::/m.test(out), "nenhuma linha começa com :::");
  assert.equal(out, "a\n::​:fim\nb :::c\n::​:");
});

const CF = require("../tools/lib/chat-format");

test("chat-format: o que renderChat escreve, as funções de leitura entendem", () => {
  const md = CF.renderChat(
    { title: 'Título "com aspas"', sessionId: "abc-123", origin: "C:\\git\\x", first: "2026-01-01T00:00:00Z", last: "2026-01-01T00:05:00Z", agent: "claude", assistantLabel: "Claude" },
    [
      { who: "user", parts: [{ kind: "text", text: "Oi" }] },
      { who: "assistant", parts: [
        { kind: "thinking", text: "hmm" },
        { kind: "tool", name: "Read", hint: "a|b.txt", input: "{}", result: "ok\n:::x", error: true },
        { kind: "note", text: "linha 1\nlinha 2" },
        { kind: "text", text: "Pronto." },
      ] },
      { who: "assistant", label: "Gemini", parts: [{ kind: "text", text: "Outro motor." }] },
    ],
  );

  const get = CF.readMeta(md);
  assert.equal(get("titulo"), 'Título \\"com aspas\\"', "o título sai como JSON (aspas internas escapadas)");
  assert.equal(get("sessao"), "abc-123");
  assert.equal(get("agente"), "claude");
  assert.equal(get("inicio"), "2026-01-01T00:00:00Z");

  assert.equal(CF.countTurns(md), 3);
  const turns = CF.splitTurns(CF.stripBlocks(CF.stripFrontmatter(md)));
  assert.deepEqual(turns.map((t) => t.speaker), ["Você", "Claude", "Gemini"]);
  assert.ok(turns[1].text.includes("Pronto.") && !turns[1].text.includes("hmm"), "blocos :::thinking e :::tool saem das falas");
  assert.match(md, /^> linha 1\n> linha 2$/m);
  assert.match(md, /:::tool Read \| a\/b\.txt \| erro/);
  assert.ok(!/^:::x/m.test(md), "::: dentro do resultado é desarmado");
});

test("chat-format: leitura tolera CRLF e BOM no cabeçalho e aceita sessao com aspas", () => {
  const raw = "\uFEFF---\r\ntitulo: \"T\"\r\nsessao: \"abc\"\r\n---\r\n# T\r\n\r\n## Você\r\n\r\noi\r\n";
  assert.equal(CF.readMeta(raw)("sessao"), "abc");
  assert.equal(CF.readMeta(raw)("titulo"), "T");
  assert.equal(CF.countTurns(raw), 1);
  assert.equal(CF.hashBody(raw), "\r\n## Você\r\n\r\noi\r\n", "sem cabeçalho nem título, bytes do conteúdo preservados");
});

test("chat-format: turnHeading reconhece os 5 falantes e nada além deles", () => {
  for (const s of ["Você", "Claude", "Gemini", "Antigravity", "opencode"]) assert.ok(CF.turnHeading().test(`## ${s}`), s);
  assert.ok(!CF.turnHeading().test("## Outro"));
  assert.ok(!CF.turnHeading().test("### Claude"));
});

test("cli: flag e opt leem --nome e --nome valor", () => {
  const argv = ["--dry-run", "--project", "dai", "--limit"];
  assert.equal(flag("dry-run", argv), true);
  assert.equal(flag("nope", argv), false);
  assert.equal(opt("project", argv), "dai");
  assert.equal(opt("nope", argv), undefined);
  assert.equal(opt("limit", argv), undefined, "opção sem valor no fim");
});

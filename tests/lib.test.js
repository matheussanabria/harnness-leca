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

test("cli: flag e opt leem --nome e --nome valor", () => {
  const argv = ["--dry-run", "--project", "dai", "--limit"];
  assert.equal(flag("dry-run", argv), true);
  assert.equal(flag("nope", argv), false);
  assert.equal(opt("project", argv), "dai");
  assert.equal(opt("nope", argv), undefined);
  assert.equal(opt("limit", argv), undefined, "opção sem valor no fim");
});

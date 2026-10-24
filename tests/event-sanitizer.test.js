// @ts-check
// Testes - Sanitizador de payload do event log (T1.2, ADR-TEL-007)

const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizePayload, LIMITS } = require("../ui/server/services/events/event-sanitizer");

test("sanitizador - redige chaves e valores com formato de segredo, preserva contagens de tokens", () => {
  const fakeKey = `sk-${"a".repeat(24)}`;
  const { payload, redacted } = sanitizePayload({
    provider: "claude",
    tokens: { input: 5, output: null, cacheRead: 0 },
    max_tokens: 100,
    apiKey: "whatever",
    access_token: "whatever",
    nested: { Authorization: `Bearer ${"abcd".repeat(4)}`, note: `use ${fakeKey} here` },
    env: "MY_API_KEY=hunter2value",
    list: [{ password: "p" }],
  });
  assert.equal(payload.provider, "claude");
  assert.deepEqual(payload.tokens, { input: 5, output: null, cacheRead: 0 });
  assert.equal(payload.max_tokens, 100);
  assert.equal(payload.apiKey, "[redacted]");
  assert.equal(payload.access_token, "[redacted]");
  assert.equal(payload.nested.Authorization, "[redacted]");
  assert.equal(payload.nested.note, "use [redacted] here");
  assert.equal(payload.env, "MY_API_KEY=[redacted]");
  assert.equal(payload.list[0].password, "[redacted]");
  assert.ok(redacted >= 6);
});

test("sanitizador - descarta texto de prompt por padrao e mantem com a flag explicita", () => {
  const input = { model: "m", prompt: "canary-prompt-text", nested: { stdout: "canary-out", content: "canary-c" } };
  const off = sanitizePayload(input, { allowText: false });
  assert.equal(JSON.stringify(off.payload).includes("canary"), false);
  assert.equal(off.payload.model, "m");
  assert.equal(off.dropped, 3);
  const on = sanitizePayload(input, { allowText: true });
  assert.equal(on.payload.prompt, "canary-prompt-text");
  assert.equal(on.payload.contentCaptured, true);
});

test("sanitizador - limites de profundidade, itens, string e tamanho; chaves perigosas caem", () => {
  let deep = { leaf: 1 };
  for (let i = 0; i < 12; i += 1) deep = { child: deep };
  assert.ok(JSON.stringify(sanitizePayload(deep).payload).includes("[truncated]"));

  const big = sanitizePayload({ list: new Array(LIMITS.items + 50).fill(1), text2: "x".repeat(LIMITS.string + 500) });
  assert.equal(big.payload.list.length, LIMITS.items);
  assert.ok(big.payload.text2.length < LIMITS.string + 20);
  assert.ok(big.truncated >= 1);

  const huge = sanitizePayload({ a: Array.from({ length: LIMITS.items }, () => "y".repeat(LIMITS.string)) });
  assert.equal(huge.ok, false);

  const evil = sanitizePayload(JSON.parse('{"__proto__": {"x": 1}, "ok": 1}'));
  assert.equal(evil.payload.ok, 1);
  assert.equal(Object.getPrototypeOf(evil.payload), Object.prototype);
  assert.equal(/** @type {any} */ ({}).x, undefined);
});


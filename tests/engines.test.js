// Testes sem dependências: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const E = require("../tools/lib/engines");
const state = require("../tools/lib/state");
const { redact } = require("../tools/lib/redact");

const PROJECTS = path.resolve(__dirname, "..", "projects");

test("safeModel recusa o que poderia virar comando no shell", () => {
  assert.equal(E.safeModel("sonnet"), "sonnet");
  assert.equal(E.safeModel("gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(E.safeModel("sonnet & calc"), "");
  assert.equal(E.safeModel("x; rm -rf /"), "");
  assert.equal(E.safeModel("$(whoami)"), "");
  assert.equal(E.safeModel(42), "");
});

test("safeEffort só aceita níveis conhecidos", () => {
  assert.equal(E.safeEffort("high"), "high");
  assert.equal(E.safeEffort("max"), "max");
  assert.equal(E.safeEffort("high | calc"), "medium");
  assert.equal(E.safeEffort(undefined), "medium");
});

test("parser do Claude não corta o texto que vem depois de uma ferramenta", () => {
  const chunks = [];
  const p = E.createClaudeStreamParser((c) => chunks.push(c), null);
  const ev = (o) => p.line(JSON.stringify(o));
  ev({ type: "system", session_id: "abc" });
  ev({ type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Vou ler o arquivo agora." }] } });
  ev({ type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Vou ler o arquivo agora." }, { type: "tool_use" }] } });
  ev({ type: "assistant", message: { id: "m2", content: [{ type: "text", text: "Pronto." }] } });
  ev({ type: "result", result: "Pronto." });

  assert.equal(p.text, "Vou ler o arquivo agora.\n\nPronto.");
  assert.equal(p.sessionId, "abc");
  assert.equal(chunks.filter((c) => c.type === "text").map((c) => c.text).join(""), p.text);
});

test("parser do Claude usa o result quando não houve texto em streaming", () => {
  const p = E.createClaudeStreamParser(() => {}, "s0");
  p.line("isto não é json");
  p.line(JSON.stringify({ type: "result", result: "Só o resultado", session_id: "s1" }));
  assert.equal(p.text, "Só o resultado");
  assert.equal(p.sessionId, "s1");
});

test("readChat: trocar ## Claude por ## opencode não muda o hash e conta os turnos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-"));
  const head = "---\nsessao: x\ninicio: \"2026-10-15T00:00:00Z\"\n---\n# T\n\n## Você\n\noi\n\n";
  fs.writeFileSync(path.join(dir, "a.md"), head + "## Claude\n\nolá\n");
  fs.writeFileSync(path.join(dir, "b.md"), head + "## opencode\n\nolá\n");
  const a = state.readChat(path.join(dir, "a.md")), b = state.readChat(path.join(dir, "b.md"));
  assert.equal(a.hash, b.hash);
  assert.equal(b.turnos, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("saveChatToProject: grava agente, não sobrescreve outra conversa e regrava a mesma", (t) => {
  const slug = `zz-teste-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));

  const turns = [{ role: "user", text: "oi" }, { role: "assistant", engine: "opencode", text: "olá" }];
  const s1 = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns, sessionId: "11111111-aaaa-4aaa-8aaa-000000000001" });
  const s2 = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns, sessionId: "22222222-aaaa-4aaa-8aaa-000000000002" });
  assert.notEqual(s1.fileName, s2.fileName);

  const again = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns: [...turns, { role: "user", text: "mais" }], sessionId: "11111111-aaaa-4aaa-8aaa-000000000001" });
  assert.equal(again.fileName, s1.fileName);
  assert.equal(fs.readdirSync(path.join(PROJECTS, slug, "chats")).length, 2);

  const raw = fs.readFileSync(s1.path, "utf8");
  assert.match(raw, /^agente: "claude"$/m);
  assert.match(raw, /^## opencode$/m, "cada resposta leva o motor que a gerou");
  assert.equal(state.readChat(s1.path).turnos, 3);
});

test("saveChatToProject: sessionId estranho não entra no nome do arquivo", (t) => {
  const slug = `zz-teste-b-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));
  const s = E.saveChatToProject({ slug, engine: "gemini", title: "x", turns: [{ role: "user", text: "a" }], sessionId: "../../etc" });
  assert.equal(path.dirname(s.path), path.join(PROJECTS, slug, "chats"));
  assert.match(s.fileName, /^\d{4}-\d{2}-\d{2}-x-[0-9a-f]{8}\.md$/);
});

test("redact remove segredos comuns", () => {
  assert.match(redact("token=abcdef123456"), /\[REDIGIDO\]/);
  assert.doesNotMatch(redact("Authorization: Bearer abcdefghijklmnop"), /abcdefghijklmnop/);
  assert.match(redact("curl -H 'Bearer abcdefghijklmnop'"), /Bearer \[REDIGIDO\]/);
  assert.match(redact("https://user:senha123@host.com"), /user:\[REDIGIDO\]@/);
  assert.equal(redact("texto comum"), "texto comum");
});

// Testes sem dependências: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Raiz temporária: os testes nunca tocam em projects/ nem em global/ de verdade. Tem de vir antes dos require abaixo.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-root-"));
process.env.HARNESS_ROOT = TMP_ROOT;
fs.mkdirSync(path.join(TMP_ROOT, "projects", "dai"), { recursive: true }); // projeto que o teste do servidor usa
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const E = require("../tools/lib/engines");
const state = require("../tools/lib/state");
const { redact } = require("../tools/lib/redact");

const PROJECTS = path.join(TMP_ROOT, "projects");

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
  fs.writeFileSync(path.join(dir, "c.md"), (head + "## Claude\n\nolá\n").replace(/\n/g, "\r\n"));
  const a = state.readChat(path.join(dir, "a.md")), b = state.readChat(path.join(dir, "b.md")), c = state.readChat(path.join(dir, "c.md"));
  assert.equal(a.hash, b.hash);
  assert.equal(b.turnos, 2);
  assert.equal(c.sessao, "x", "arquivo todo em CRLF não perde o cabeçalho");
  assert.equal(c.turnos, 2);

  // O hash é bytes do conteúdo (sem cabeçalho nem título), exatamente como já está gravado nos extraction-state.json:
  // normalizar CRLF aqui faria todas as conversas com saída de comando do Windows virarem "alteradas".
  const crypto = require("crypto");
  const body = "\n## Você\n\noi\n\n## Claude\n\nolá\n";
  assert.equal(a.hash, crypto.createHash("sha1").update(body).digest("hex").slice(0, 16));
  const withCrInContent = state.readChat((() => { const f = path.join(dir, "d.md"); fs.writeFileSync(f, head + "## Claude\n\nsaída\r\ndo comando\n"); return f; })());
  assert.equal(withCrInContent.hash, crypto.createHash("sha1").update("\n## Você\n\noi\n\n## Claude\n\nsaída\r\ndo comando\n").digest("hex").slice(0, 16));
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

test("saveChatToProject: mesmo formato dos importadores, inicio preservado e arquivo antigo com aspas reconhecido", async (t) => {
  const slug = `zz-teste-c-${process.pid}`;
  const chats = path.join(PROJECTS, slug, "chats");
  fs.mkdirSync(chats, { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));
  const sid = "33333333-aaaa-4aaa-8aaa-000000000003";
  const turns = [{ role: "user", text: "oi" }, { role: "assistant", text: "olá\n:::fim", thinking: "pensei", engine: "claude" }];

  const first = E.saveChatToProject({ slug, engine: "claude", title: "Formato", turns, sessionId: sid });
  const raw1 = fs.readFileSync(first.path, "utf8");
  assert.match(raw1, new RegExp(`^sessao: ${sid}$`, "m"), "sem aspas, como nos importadores");
  assert.match(raw1, /^origem: "harness-ui"$/m);
  assert.ok(!/^:::fim/m.test(raw1), "::: no conteúdo é desarmado");

  await new Promise((r) => setTimeout(r, 15));
  const second = E.saveChatToProject({ slug, engine: "claude", title: "Formato", turns: [...turns, { role: "user", text: "e mais" }], sessionId: sid });
  assert.equal(second.fileName, first.fileName);
  const raw2 = fs.readFileSync(second.path, "utf8");
  const meta = (raw, k) => require("../tools/lib/chat-format").readMeta(raw)(k);
  assert.equal(meta(raw2, "inicio"), meta(raw1, "inicio"), "inicio não muda ao salvar de novo");
  assert.notEqual(meta(raw2, "fim"), meta(raw1, "fim"));

  // Arquivo gravado pela versão antiga da interface (sessao entre aspas) é reconhecido como a mesma conversa.
  const sidOld = "44444444-aaaa-4aaa-8aaa-000000000004";
  const legacy = path.join(chats, "2026-01-01-antigo-44444444.md");
  fs.writeFileSync(legacy, `---\ntitulo: "Antigo"\nsessao: "${sidOld}"\nagente: "claude"\ninicio: "2026-01-01T00:00:00.000Z"\nfim: "2026-01-01T00:00:00.000Z"\n---\n\n# Antigo\n\n## Você\noi\n`);
  const upd = E.saveChatToProject({ slug, engine: "claude", title: "Antigo", turns, sessionId: sidOld });
  assert.equal(upd.fileName, "2026-01-01-antigo-44444444.md");
  assert.equal(meta(fs.readFileSync(upd.path, "utf8"), "inicio"), "2026-01-01T00:00:00.000Z");
});

test("saveChatToProject: metadados HIA viram bloco hia-script no arquivo", (t) => {
  const slug = `zz-teste-hia-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));

  const turns = [
    { role: "user", text: "resuma" },
    { role: "assistant", engine: "claude", text: "pronto", hiaRoute: "script", hiaTool: "hia.summarize", tokensSaved: 120 },
    { role: "assistant", engine: "claude", text: "sem hia" },
  ];
  const saved = E.saveChatToProject({ slug, engine: "claude", title: "HIA", turns, sessionId: "55555555-aaaa-4aaa-8aaa-000000000005" });
  const raw = fs.readFileSync(saved.path, "utf8");

  assert.match(raw, /^:::tool hia-script \| hia\.summarize$/m);
  assert.match(raw, /--- resultado\n120\n:::/m);
  assert.equal(raw.match(/^:::tool hia-script/gm).length, 1, "só o turno com HIA ganha o bloco");
  assert.equal(state.readChat(saved.path).turnos, 3);
});

test("saveChatToProject: motor Ollama assina o cabeçalho e o bloco HIA local", (t) => {
  const slug = `zz-teste-ollama-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));

  const turns = [
    { role: "user", text: "classifique isso" },
    { role: "assistant", engine: "ollama", text: "classe A", hiaRoute: "local_llm", hiaModel: "qwen2.5-coder:1.5b", tokensSaved: 800 },
  ];
  const saved = E.saveChatToProject({ slug, engine: "ollama", title: "Local", turns, sessionId: "66666666-aaaa-4aaa-8aaa-000000000006" });
  const raw = fs.readFileSync(saved.path, "utf8");

  assert.match(raw, /^agente: "ollama"$/m);
  assert.match(raw, /^## Ollama$/m, "o turno leva o motor local, não Claude");
  assert.match(raw, /^:::tool hia-local_llm \| qwen2\.5-coder:1\.5b$/m);
  assert.match(raw, /--- resultado\n800\n:::/m);
  assert.equal(state.readChat(saved.path).turnos, 2, "o formato segue reconhecendo os turnos do motor local");
});

test("saveChatToProject: sessionId estranho não entra no nome do arquivo", (t) => {
  const slug = `zz-teste-b-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));
  const s = E.saveChatToProject({ slug, engine: "gemini", title: "x", turns: [{ role: "user", text: "a" }], sessionId: "../../etc" });
  assert.equal(path.dirname(s.path), path.join(PROJECTS, slug, "chats"));
  assert.match(s.fileName, /^\d{4}-\d{2}-\d{2}-x-[0-9a-f]{8}\.md$/);
});


// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-claude-export-root-"));
fs.mkdirSync(path.join(root, "projects", "57multimarcas", "chats"), { recursive: true });
process.env.HARNESS_ROOT = root;
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const { convertChatMdToJsonl, run } = require("../tools/export-claude-sessions");

test("convertChatMdToJsonl: converte chat markdown em eventos jsonl válidos do Claude Code", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-export-test-"));
  const mdFile = path.join(tmpDir, "chat-test.md");

  const mdContent = `---
titulo: "Conversa de teste"
sessao: "12345678-1234-4000-8000-123456789012"
origem: "c:\\\\git\\\\meu-projeto"
inicio: 2026-05-10T10:00:00Z
fim: 2026-05-10T10:05:00Z
agente: "gemini"
---

# Conversa de teste

## Você

Como posso organizar o backend?

## Gemini

:::thinking
Analisando estrutura de Clean Architecture...
:::

Recomendo dividir em Domain, Use Cases e Adapters.

## Você

Perfeito, obrigado!

## Gemini

De nada! Bons estudos.
`;

  fs.writeFileSync(mdFile, mdContent, "utf8");

  const result = convertChatMdToJsonl(mdFile, "c:\\git\\meu-projeto");
  assert.ok(result);
  assert.equal(result.sessionId, "12345678-1234-4000-8000-123456789012");
  assert.equal(result.title, "Conversa de teste");
  assert.equal(result.turnsCount, 4);

  // Valida que cada linha é um JSON válido
  const parsed = result.lines.map((l) => JSON.parse(l));
  assert.equal(parsed[0].type, "mode");
  assert.equal(parsed[1].type, "permission-mode");

  const userEvents = parsed.filter((e) => e.type === "user");
  const assistantEvents = parsed.filter((e) => e.type === "assistant");

  assert.equal(userEvents.length, 2);
  assert.equal(assistantEvents.length, 2);
  assert.equal(userEvents[0].message.content, "Como posso organizar o backend?");
  assert.ok(assistantEvents[0].message.content[0].text.includes("Clean Architecture"));

  const lastPrompt = parsed.find((e) => e.type === "last-prompt");
  assert.ok(lastPrompt);
  assert.equal(lastPrompt.lastPrompt, "Perfeito, obrigado!");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("convertChatMdToJsonl: gera UUID válido se a sessão original for do opencode", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-export-test2-"));
  const mdFile = path.join(tmpDir, "opencode-chat.md");

  const mdContent = `---
titulo: "Chat Opencode"
sessao: "ses_27fd2b712ffenAM84Vx5mYnRQ6"
agente: "opencode"
---

## Você

Oi

## opencode

Olá!
`;

  fs.writeFileSync(mdFile, mdContent, "utf8");

  const result = convertChatMdToJsonl(mdFile, "c:\\git\\projeto");
  assert.ok(result);
  // Deve ser um UUID RFC 4122 válido
  assert.match(result.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("run: dry-run executa sem erros e sem gravar nada", () => {
  const logs = [];
  const fakeIo = { log: (msg) => logs.push(msg) };

  assert.doesNotThrow(() => {
    run(["--dry-run", "--project", "57multimarcas"], fakeIo);
  });

  assert.ok(logs.some((l) => l.includes("[SIMULAÇÃO / DRY RUN]")));
});

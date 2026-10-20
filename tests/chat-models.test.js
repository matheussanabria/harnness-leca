import test from "node:test";
import assert from "node:assert/strict";
import {
  createChatMessage,
  extractCodeBlocksFromMarkdown,
  createChatSession,
  createChatExecutionState
} from "../ui/public/js/modules/chat-models.js";

test("createChatMessage normaliza atributos essenciais e extrai blocos de código", () => {
  const content = "Aqui está a solução:\n```typescript src/main.ts\nconst x: number = 42;\n```\nFim.";
  const msg = createChatMessage({
    chatId: "chat-123",
    role: "assistant",
    content,
    engine: "claude"
  });

  assert.equal(msg.chatId, "chat-123");
  assert.equal(msg.role, "assistant");
  assert.equal(msg.engine, "claude");
  assert.ok(msg.id.startsWith("msg-"));
  assert.equal(msg.codeBlocks.length, 1);
  assert.equal(msg.codeBlocks[0].language, "typescript");
  assert.equal(msg.codeBlocks[0].filename, "src/main.ts");
  assert.equal(msg.codeBlocks[0].code.trim(), "const x: number = 42;");
});

test("extractCodeBlocksFromMarkdown extrai múltiplos blocos com segurança", () => {
  const md = `
Texto inicial
\`\`\`javascript
console.log("bloco 1");
\`\`\`
Texto intermediário
\`\`\`css styles.css
.classe { color: blue; }
\`\`\`
`;
  const blocks = extractCodeBlocksFromMarkdown(md);
  assert.equal(blocks.length, 2);

  assert.equal(blocks[0].language, "javascript");
  assert.equal(blocks[0].filename, undefined);
  assert.ok(blocks[0].code.includes("console.log"));

  assert.equal(blocks[1].language, "css");
  assert.equal(blocks[1].filename, "styles.css");
  assert.ok(blocks[1].code.includes(".classe"));
});

test("createChatSession inicializa entidade de sessão com defaults consistentes", () => {
  const session = createChatSession({
    id: "session-abc",
    projectId: "saude-dispensacao",
    title: "Refatoração de Telas"
  });

  assert.equal(session.id, "session-abc");
  assert.equal(session.projectId, "saude-dispensacao");
  assert.equal(session.title, "Refatoração de Telas");
  assert.equal(session.engine, "gemini");
  assert.equal(session.messageCount, 0);
  assert.ok(session.createdAt > 0);
});

test("createChatExecutionState rastreia status de execução e cancelamento", () => {
  const execution = createChatExecutionState("chat-123", "opencode", "streaming");
  assert.equal(execution.chatId, "chat-123");
  assert.equal(execution.engine, "opencode");
  assert.equal(execution.status, "streaming");
  assert.equal(execution.errorMessage, null);
  assert.ok(execution.startedAt > 0);
});

// @ts-check
/**
 * Modelos Canônicos de Mensagens, Sessões e Execuções do Chat Universal
 * Responsabilidade Única: Normalização pura de entidades de conversação, validação e extração de blocos de código.
 */

/**
 * Normaliza e cria uma instância de ChatMessage
 * @param {Partial<import("../types/chat-models").ChatMessage> & { content: string, role?: import("../types/chat-models").ChatRole }} params
 * @returns {import("../types/chat-models").ChatMessage}
 */
export function createChatMessage(params) {
  const role = params.role === "assistant" || params.role === "system" ? params.role : "user";
  const content = typeof params.content === "string" ? params.content : "";
  const timestamp = typeof params.timestamp === "number" ? params.timestamp : Date.now();
  const id = params.id || `msg-${timestamp}-${Math.floor(Math.random() * 10000)}`;

  const codeBlocks = params.codeBlocks || extractCodeBlocksFromMarkdown(content);

  return {
    id,
    chatId: params.chatId || "draft",
    role,
    content,
    timestamp,
    engine: params.engine || "gemini",
    model: params.model || undefined,
    thinking: params.thinking || null,
    codeBlocks,
    metadata: params.metadata || {}
  };
}

/**
 * Extrai blocos de código markdown delimitados por crases triplas
 * @param {string} markdown
 * @returns {Array<{ language: string, code: string, filename?: string }>}
 */
export function extractCodeBlocksFromMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") return [];

  const regex = /```([a-zA-Z0-9_\-\.]+)?(?:\s+([a-zA-Z0-9_\-\.\/]+))?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const language = (match[1] || "text").trim().toLowerCase();
    const filename = match[2] ? match[2].trim() : undefined;
    const code = match[3] ? match[3].replace(/\r\n/g, "\n") : "";

    blocks.push({
      language,
      code,
      filename
    });
  }

  return blocks;
}

/**
 * Cria ou normaliza uma instância de ChatSession
 * @param {Partial<import("../types/chat-models").ChatSession> & { id: string, projectId: string }} params
 * @returns {import("../types/chat-models").ChatSession}
 */
export function createChatSession(params) {
  const now = Date.now();
  return {
    id: params.id,
    projectId: params.projectId || "default",
    title: params.title || "Nova Conversa",
    engine: params.engine || "gemini",
    engineSessionId: params.engineSessionId || null,
    messageCount: typeof params.messageCount === "number" ? params.messageCount : 0,
    createdAt: typeof params.createdAt === "number" ? params.createdAt : now,
    updatedAt: typeof params.updatedAt === "number" ? params.updatedAt : now
  };
}

/**
 * Cria ou atualiza o estado de execução de um chat
 * @param {string} chatId
 * @param {string} engine
 * @param {import("../types/chat-models").ChatExecutionStatus} [status]
 * @returns {import("../types/chat-models").ChatExecutionState}
 */
export function createChatExecutionState(chatId, engine, status = "idle") {
  return {
    chatId,
    engine,
    status,
    startedAt: Date.now(),
    errorMessage: null
  };
}

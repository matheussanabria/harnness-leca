/**
 * Contratos de Tipagem do Chat Universal
 */

export type ChatRole = "user" | "assistant" | "system";

export type ChatExecutionStatus = "idle" | "streaming" | "done" | "error" | "cancelled";

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  engine?: string;
  model?: string;
  thinking?: string | null;
  codeBlocks?: Array<{
    language: string;
    code: string;
    filename?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  engine: string;
  engineSessionId?: string | null;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatExecutionState {
  chatId: string;
  engine: string;
  status: ChatExecutionStatus;
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string | null;
}

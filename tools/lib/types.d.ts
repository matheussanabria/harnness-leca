// Contratos entre os módulos de tools/lib. Só tipos: não existe em tempo de execução. Usados por JSDoc
// (`@param {import("./types").Turn[]} turns`) e conferidos por `npm run types`.

// ---- conversa (tools/lib/chat-format.js) ----

export type Part =
  | { kind: "text"; text: string }
  | { kind: "note"; text: string }
  | { kind: "thinking"; text: string; /** não corta o texto no limite MAX_IO (chats salvos pela interface) */ full?: boolean }
  | { kind: "tool"; name: string; hint: string; input: string; result: string; error?: boolean };

export interface Turn {
  /** "user" ou qualquer outro valor (a resposta do modelo) */
  who: string;
  /** título do turno quando não é o do cabeçalho (ex.: o motor que respondeu) */
  label?: string;
  parts: Part[];
}

export interface ChatMeta {
  title: string;
  sessionId: string;
  origin: string;
  first?: string;
  last?: string;
  agent: string;
  assistantLabel: string;
}

// ---- gravação de chats (tools/lib/chat-store.js) ----

export type WriteState = "nova" | "atualizada" | "sem mudança";

export interface WriteChatOptions {
  chatsDir: string;
  name: string;
  sessionId: string;
  shortId: string;
  text: string;
  /** data da última mensagem (ISO ou ms): vira o mtime do arquivo */
  mtime?: string | number;
  dryRun?: boolean;
}

// ---- controle de extração (tools/lib/state.js e extraction.js) ----

export type ExtractionStatus = "nova" | "alterada" | "ok";

export interface StateEntry {
  /** versão do formato do hash; entradas antigas não têm */
  v?: number;
  arquivo?: string;
  titulo?: string;
  hash: string;
  turnos: number;
  fim?: string;
  analisadoEm?: string;
  por?: string;
}

export interface ChatInfo {
  name: string;
  sessao: string;
  titulo: string;
  data: string;
  fim: string;
  turnos: number;
  hash: string;
}

export interface ChatRow extends ChatInfo {
  status: ExtractionStatus;
  adopt: boolean;
  antes: StateEntry | null;
}

// ---- importadores (tools/import-*.js) ----

export interface Counts { nova: number; atualizada: number; igual: number }

export interface ImportResult extends Counts {
  ignoradas: number;
  /** só o importador do Gemini: contagens por projeto */
  porProjeto?: Record<string, Counts>;
}

export interface Io { log(line: string): void }

// ---- motores de chat (tools/lib/engines) ----

export interface EngineSink {
  onChunk(data: { type: "text" | "thinking"; text: string; sessionId?: string | null }): void;
  onDone(data: { sessionId?: string | null; fullText?: string }): void;
  onError(err: Error): void;
}

export interface EngineRequest extends EngineSink {
  prompt: string;
  slug: string;
  sessionId?: string;
  history?: { role: string; text: string }[];
  model?: string;
  effort?: string;
  signal?: AbortSignal;
}

/** Entrada de catalog.json: o que é estático em cada motor (chaves com "_" não vão para a interface). */
export interface EngineCatalogEntry {
  name: string;
  icon: string;
  color: string;
  description: string;
  auth?: string;
  defaultModel: string;
  defaultEffort: string;
  effortLevels: { id: string; label: string }[];
  models: { id: string; name: string; desc: string }[];
  [key: string]: unknown;
}

export interface Engine {
  id: string;
  stream(req: EngineRequest): void | Promise<void>;
  /** parte dinâmica do status (disponibilidade, modelos...); o resto vem do catálogo */
  status(catalog: EngineCatalogEntry): Promise<Record<string, unknown>>;
}

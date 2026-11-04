// Read-only model shared by the pure context-pack builder and its Markdown renderer.
export interface PackNode {
  id: string;
  text: string;
  children: PackNode[];
}

/** JSON companion of the pack: identifiers and normalized text only, never model extras. */
export interface PackJson {
  schema: "context-pack@1";
  empty: boolean;
  board: string | null;
  path: Array<{ id: string; text: string }>;
  tree: PackNode | null;
  truncated: boolean;
  omitted: number;
  budget: number;
}

export interface ContextPack {
  schema: "context-pack@1";
  empty: boolean;
  markdown: string;
  json: PackJson;
  truncated: boolean;
  omitted: number;
  budget: number;
}

export interface PackOptions {
  /** Maximum Markdown length in characters. Clamped to at least MIN_BUDGET. */
  budget?: number;
  boardTitle?: string;
}

export const CONTEXT_PACK_SCHEMA = "context-pack@1";
export const DEFAULT_BUDGET = 4000;
export const MIN_BUDGET = 200;
export const MAX_NODE_TEXT = 300;
export const MAX_PATH_TEXT = 80;
/** Defensive cap so a long board title cannot crowd out the content. */
export const MAX_BOARD_TEXT = 120;

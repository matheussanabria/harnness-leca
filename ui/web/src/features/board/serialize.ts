// Pure conversion between the Excalidraw scene and the opaque board `data` payload (schema "excalidraw@1").
import { isFileRef, pruneManifest } from "./assetRefs.ts";
import { sanitizeAppState } from "./sanitize.ts";
import { BOARD_SCHEMA, type BoardData, type FileManifest, type SceneElement } from "./types.ts";

/** Server cap on `data` (MAX_BOARD_BYTES); we stop a little earlier so the envelope never tips it over. */
export const MAX_DATA_BYTES = 4 * 1024 * 1024 - 4096;

export class UnsupportedBoardError extends Error {
  constructor(schema: unknown) {
    super(`This board uses an unsupported format (${String(schema)}).`);
    this.name = "UnsupportedBoardError";
  }
}

export class BoardTooLargeError extends Error {
  constructor(bytes: number) {
    super(`The board is too large to save (${Math.ceil(bytes / 1024)} KB, limit ${MAX_DATA_BYTES / 1024} KB).`);
    this.name = "BoardTooLargeError";
  }
}

export interface Scene {
  elements: SceneElement[];
  appState: Record<string, string | number | boolean | null>;
  files: FileManifest;
}

function isElement(value: unknown): value is SceneElement {
  if (!value || typeof value !== "object") return false;
  const { id, type } = value as Record<string, unknown>;
  return typeof id === "string" && id !== "" && typeof type === "string" && type !== "";
}

/** Builds the `data` payload: drops deleted elements, sanitises appState, keeps only used asset references. */
export function serializeScene(
  elements: readonly SceneElement[],
  appState: unknown,
  manifest: FileManifest,
): BoardData {
  const live = elements.filter((element) => !element.isDeleted);
  return {
    schema: BOARD_SCHEMA,
    elements: live,
    appState: sanitizeAppState(appState),
    files: pruneManifest(manifest, live),
  };
}

/** Throws BoardTooLargeError when the JSON form exceeds the cap; returns the JSON size in bytes. */
export function assertWithinLimit(data: unknown): number {
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  if (bytes > MAX_DATA_BYTES) throw new BoardTooLargeError(bytes);
  return bytes;
}

/** Reads a stored payload. A new board (`{}`) is an empty scene; foreign schemas are refused; bad parts are dropped. */
export function deserializeScene(raw: unknown): Scene {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new UnsupportedBoardError(typeof raw);
  const data = raw as Record<string, unknown>;
  if (Object.keys(data).length === 0) return { elements: [], appState: {}, files: {} };
  if (data.schema !== BOARD_SCHEMA) throw new UnsupportedBoardError(data.schema);
  const elements = Array.isArray(data.elements) ? data.elements.filter(isElement) : [];
  const files: FileManifest = {};
  if (data.files && typeof data.files === "object" && !Array.isArray(data.files)) {
    for (const [id, ref] of Object.entries(data.files)) if (isFileRef(ref)) files[id] = ref;
  }
  return { elements, appState: sanitizeAppState(data.appState), files };
}

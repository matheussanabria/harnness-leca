// Cheap change detection for Excalidraw's onChange, which also fires for selection and scrolling.
// Elements carry a `version` that grows on every edit, so id:version pairs plus the persisted appState are enough.
import { sanitizeAppState } from "./sanitize.ts";
import type { SceneElement } from "./types";

export function sceneSignature(elements: readonly SceneElement[], appState: unknown): string {
  const parts = elements.map((element) => `${element.id}:${String(element.version ?? "")}`);
  return `${parts.join("|")}#${JSON.stringify(sanitizeAppState(appState))}`;
}

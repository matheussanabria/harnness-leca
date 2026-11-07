// Cheap change detection for Excalidraw's onChange, which also fires for selection and scrolling.
// Elements carry a `version` that grows on every edit, so id:version pairs plus the persisted appState are enough.
import { sanitizeAppState } from "./sanitize.ts";
import type { SceneElement } from "./types";

// Loaded image files are part of the signature: Excalidraw can deliver a file after its element, and that late
// arrival must trigger a save so the image is uploaded instead of leaving a dangling reference.
export function sceneSignature(
  elements: readonly SceneElement[],
  appState: unknown,
  files: Record<string, unknown> = {},
): string {
  const parts = elements.map((element) => `${element.id}:${String(element.version ?? "")}`);
  const fileIds = Object.keys(files).sort().join(",");
  return `${parts.join("|")}#${JSON.stringify(sanitizeAppState(appState))}#${fileIds}`;
}

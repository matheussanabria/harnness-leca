// appState sanitising: only a small allowlist of durable drawing preferences is persisted.
// Volatile or sensitive keys (collaborators, selection, scroll, open menus, pointer state) never reach the server.
import type { Primitive } from "./types";

export const PERSISTED_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "gridSize",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemStrokeStyle",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "currentItemStartArrowhead",
  "currentItemEndArrowhead",
] as const;

/** Keeps allowlisted keys whose value is a string, finite number, boolean or null. Never throws. */
export function sanitizeAppState(input: unknown): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (!Object.hasOwn(input, key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) out[key] = value as Primitive;
  }
  return out;
}

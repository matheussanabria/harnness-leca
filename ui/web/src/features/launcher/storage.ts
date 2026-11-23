// Remembers the launcher's chosen scope in this browser (a per-viewer convenience, EP-25.05).
// Reads and writes are wrapped: the launcher must work when storage is blocked or full.
export const SCOPE_STORAGE_KEY = "harness_launcher_project";

export function loadScope(storage: Pick<Storage, "getItem"> | null = safeStorage()): string | null {
  try {
    const value = storage?.getItem(SCOPE_STORAGE_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

/** null (no project) removes the key so the next visit starts without a project. */
export function saveScope(
  project: string | null,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = safeStorage(),
): void {
  try {
    if (project) storage?.setItem(SCOPE_STORAGE_KEY, project);
    else storage?.removeItem(SCOPE_STORAGE_KEY);
  } catch {
    /* blocked or full: the scope is simply not remembered */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

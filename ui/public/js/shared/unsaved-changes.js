// @ts-check

export const UNSAVED_CHANGES_ERROR = "UNSAVED_CHANGES";

export class UnsavedChangesError extends Error {
  /** @param {ReadonlyArray<UnsavedChange>} blockers */
  constructor(blockers) {
    super("Existem alterações não salvas que impedem a troca de contexto.");
    this.name = "UnsavedChangesError";
    this.code = UNSAVED_CHANGES_ERROR;
    this.blockers = blockers;
  }
}

/**
 * @typedef {object} UnsavedChange
 * @property {string} id
 * @property {string} label
 * @property {string} [projectSlug]
 * @property {string} [workspaceId]
 */

export class UnsavedChangesRegistry {
  constructor() {
    /** @type {Map<string, Readonly<UnsavedChange>>} */
    this.entries = new Map();
    this.listeners = new Set();
  }

  /** @param {string} id @param {Omit<UnsavedChange, "id">} change */
  mark(id, change) {
    const normalizedId = typeof id === "string" ? id.trim() : "";
    const label = typeof change?.label === "string" ? change.label.trim() : "";
    if (!normalizedId || !label) throw new TypeError("Alteração não salva exige id e label.");

    const entry = Object.freeze({
      id: normalizedId,
      label,
      ...(cleanValue(change.projectSlug) ? { projectSlug: cleanValue(change.projectSlug) } : {}),
      ...(cleanValue(change.workspaceId) ? { workspaceId: cleanValue(change.workspaceId) } : {})
    });
    this.entries.set(normalizedId, entry);
    this.#notify();
    return entry;
  }

  /** @param {string} id */
  clear(id) {
    const removed = this.entries.delete(id);
    if (removed) this.#notify();
    return removed;
  }

  /** @param {{ projectSlug?: string, workspaceId?: string }} [context] */
  list(context = {}) {
    return Object.freeze(
      [...this.entries.values()].filter((entry) => matchesContext(entry, context))
    );
  }

  /** @param {{ projectSlug?: string, workspaceId?: string }} [context] */
  hasChanges(context) {
    return this.list(context).length > 0;
  }

  /** @param {{ projectSlug?: string, workspaceId?: string }} [context] */
  assertCanTransition(context) {
    const blockers = this.list(context);
    if (blockers.length) throw new UnsavedChangesError(blockers);
  }

  /** @param {(changes: ReadonlyArray<UnsavedChange>) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    if (!this.entries.size) return;
    this.entries.clear();
    this.#notify();
  }

  #notify() {
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function cleanValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function matchesContext(entry, context) {
  const project = cleanValue(context.projectSlug).toLowerCase();
  const workspace = cleanValue(context.workspaceId);
  if (project && entry.projectSlug && entry.projectSlug.toLowerCase() !== project) return false;
  if (workspace && entry.workspaceId && entry.workspaceId !== workspace) return false;
  return true;
}

export const unsavedChanges = new UnsavedChangesRegistry();

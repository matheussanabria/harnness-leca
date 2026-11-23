// @ts-check
// Artifact registry repository (EP-25.03, migration 025). Receives the connection by injection.
// Registering is idempotent by source_key, so an importer can run any number of times.
const { createRepoBase } = require("../repo-base");
const { newArtifactId } = require("../../services/artifacts/artifact-id");

/** @typedef {{ id: string, type: string, owner: string, title: string, derivedFrom: string|null, sourceKey: string|null, createdAt: string, updatedAt: string }} Artifact */
/** @typedef {{ path: string, contentHash?: string|null }} ArtifactFile */

/** @param {any} row @returns {Artifact} */
const toArtifact = (row) => ({
  id: String(row.id),
  type: String(row.type),
  owner: String(row.owner_slug),
  title: String(row.title),
  derivedFrom: row.derived_from ?? null,
  sourceKey: row.source_key ?? null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

/** @param {import("node:sqlite").DatabaseSync} db */
function createArtifactRepo(db) {
  const base = createRepoBase(db);
  const { prepare, transaction, toJson, fromJson } = base;

  /** @param {string} id @returns {Artifact|null} */
  function get(id) {
    const row = prepare("SELECT * FROM artifacts WHERE id = ?").get(id);
    return row ? toArtifact(row) : null;
  }

  /** @param {string} sourceKey @returns {Artifact|null} */
  function getBySourceKey(sourceKey) {
    const row = prepare("SELECT * FROM artifacts WHERE source_key = ?").get(sourceKey);
    return row ? toArtifact(row) : null;
  }

  /**
   * Registers an artifact, or returns the one already registered under the same sourceKey.
   * @param {{ type: string, owner: string, title: string, files?: ArtifactFile[], sourceKey?: string|null,
   *   derivedFrom?: string|null, actor?: string, action?: "create"|"copy", createdAt?: string, id?: string }} input
   * @returns {{ artifact: Artifact, created: boolean }}
   */
  function register({ type, owner, title, files = [], sourceKey = null, derivedFrom = null, actor = "system", action, createdAt, id }) {
    if (!type || !owner || !title) throw new Error("type, owner and title are required");
    return transaction(() => {
      if (sourceKey) {
        const existing = getBySourceKey(sourceKey);
        if (existing) return { artifact: existing, created: false };
      }
      const now = new Date().toISOString();
      const newId = id || newArtifactId();
      prepare(`INSERT INTO artifacts (id, type, owner_slug, title, derived_from, source_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(newId, type, owner, title, derivedFrom, sourceKey, createdAt || now, now);
      const insertFile = prepare("INSERT OR REPLACE INTO artifact_files (artifact_id, path, content_hash) VALUES (?, ?, ?)");
      for (const f of files) insertFile.run(newId, f.path, f.contentHash ?? null);
      prepare("INSERT INTO artifact_ownership_log (artifact_id, from_owner, to_owner, action, at, actor) VALUES (?, NULL, ?, ?, ?, ?)")
        .run(newId, owner, action || (derivedFrom ? "copy" : "create"), now, actor);
      return { artifact: /** @type {Artifact} */ (get(newId)), created: true };
    });
  }

  /** @param {string} owner @param {{ type?: string }} [filter] @returns {Artifact[]} */
  function listByOwner(owner, { type } = {}) {
    const rows = type
      ? prepare("SELECT * FROM artifacts WHERE owner_slug = ? AND type = ? ORDER BY created_at, id").all(owner, type)
      : prepare("SELECT * FROM artifacts WHERE owner_slug = ? ORDER BY created_at, id").all(owner);
    return rows.map(toArtifact);
  }

  /** @param {string} id @returns {ArtifactFile[]} */
  function filesOf(id) {
    return prepare("SELECT path, content_hash FROM artifact_files WHERE artifact_id = ? ORDER BY path").all(id)
      .map((r) => ({ path: String(r.path), contentHash: r.content_hash ?? null }));
  }

  /** @param {any} r */
  const toLog = (r) => ({
    id: Number(r.id), from: r.from_owner ?? null, to: String(r.to_owner), action: String(r.action),
    at: String(r.at), actor: String(r.actor), undoOf: r.undo_of ?? null,
    snapshot: r.snapshot ? fromJson(r.snapshot, []) : [],
  });

  /** Ownership history, oldest first. @param {string} id */
  function history(id) {
    return prepare("SELECT * FROM artifact_ownership_log WHERE artifact_id = ? ORDER BY id").all(id).map(toLog);
  }

  /** @param {number} logId */
  function getLog(logId) {
    const row = prepare("SELECT * FROM artifact_ownership_log WHERE id = ?").get(logId);
    return row ? { artifactId: String(row.artifact_id), ...toLog(row) } : null;
  }

  /** The newest ownership entry of an artifact, or null. @param {string} id */
  function lastLog(id) {
    const row = prepare("SELECT * FROM artifact_ownership_log WHERE artifact_id = ? ORDER BY id DESC LIMIT 1").get(id);
    return row ? toLog(row) : null;
  }

  /**
   * Changes the owner, replaces the file list and the source key, and logs a move. Call inside transaction().
   * @param {string} id @param {string} newOwner
   * @param {{ files: ArtifactFile[], sourceKey?: string|null, actor?: string, undoOf?: number|null }} change
   * @returns {number} the new log id
   */
  function setOwner(id, newOwner, { files, sourceKey = null, actor = "system", undoOf = null }) {
    const current = get(id);
    if (!current) throw new Error("artifact not found");
    const now = new Date().toISOString();
    prepare("UPDATE artifacts SET owner_slug = ?, source_key = ?, updated_at = ? WHERE id = ?").run(newOwner, sourceKey, now, id);
    prepare("DELETE FROM artifact_files WHERE artifact_id = ?").run(id);
    const insertFile = prepare("INSERT INTO artifact_files (artifact_id, path, content_hash) VALUES (?, ?, ?)");
    for (const f of files) insertFile.run(id, f.path, f.contentHash ?? null);
    const result = prepare(
      "INSERT INTO artifact_ownership_log (artifact_id, from_owner, to_owner, action, at, actor, snapshot, undo_of) VALUES (?, ?, ?, 'move', ?, ?, ?, ?)"
    ).run(id, current.owner, newOwner, now, actor, toJson(files.map((f) => ({ path: f.path, contentHash: f.contentHash ?? null }))), undoOf);
    return Number(result.lastInsertRowid);
  }

  /**
   * What points at this artifact: the one it was copied from and the copies made from it.
   * @param {string} id @returns {{ derivedFrom: Artifact|null, derivatives: Artifact[] }}
   */
  function findReferences(id) {
    const self = get(id);
    return {
      derivedFrom: self && self.derivedFrom ? get(self.derivedFrom) : null,
      derivatives: prepare("SELECT * FROM artifacts WHERE derived_from = ? ORDER BY created_at, id").all(id).map(toArtifact),
    };
  }

  return { transaction, get, getBySourceKey, register, listByOwner, filesOf, history, getLog, lastLog, setOwner, findReferences };
}

module.exports = { createArtifactRepo };

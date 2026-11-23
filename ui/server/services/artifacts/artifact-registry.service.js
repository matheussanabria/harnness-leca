// @ts-check
// Artifact registry in the host database (EP-25.03). Features call register* when they create something.
// Fails open, like the chat store: a database problem never breaks the feature that created the artifact.
// HARNESS_ARTIFACT_REGISTRY=off turns it off (rollback).
const { getDb } = require("../../db/connection");
const { createArtifactRepo } = require("../../db/repos/artifact.repo");
const { canvasRegistration } = require("./artifact-canvas");

/** @typedef {ReturnType<typeof createArtifactRepo>} ArtifactRepo */
/** @type {ArtifactRepo | null | undefined} undefined = not opened yet */
let store;

/** @param {string} where @param {unknown} error */
function warn(where, error) {
  console.warn(`[artifact-registry] ${where}:`, (error && /** @type {any} */ (error).message) || error);
}

/** @returns {ArtifactRepo | null} */
function getStore() {
  if (process.env.HARNESS_ARTIFACT_REGISTRY === "off") return null;
  if (store !== undefined) return store;
  // A redirected projects dir with the default database would register foreign files in the real registry.
  if (process.env.HARNESS_PROJECTS_DIR && !process.env.HARNESS_DB_PATH) return null;
  try {
    store = createArtifactRepo(getDb());
  } catch (error) {
    warn("open", error);
    store = null;
  }
  return store;
}

/** Tests inject a repository (or null to disable); undefined resets to lazy opening. */
function setStore(/** @type {ArtifactRepo | null | undefined} */ repo) {
  store = repo;
}

/**
 * Registers a Canvas board that was just written. Returns the artifact id, or null when nothing was registered.
 * @param {string} owner project slug or "_pessoal" @param {any} board @param {string} absoluteFile
 */
function registerCanvasBoard(owner, board, absoluteFile) {
  const repo = getStore();
  if (!repo) return null;
  try {
    const input = canvasRegistration(owner, board, absoluteFile);
    return input ? repo.register({ ...input, actor: "web" }).artifact.id : null;
  } catch (error) {
    warn("register", error);
    return null;
  }
}

module.exports = { getStore, setStore, registerCanvasBoard };

// @ts-check
// Shared planning for move, copy and preview (EP-25.04). Validates, asks the type adapter what to do and lists
// collisions and links that would break. Nothing here writes to disk or to the database.
const fs = require("fs");
const path = require("path");
const { slugs } = require("../../config");
const { PERSONAL_SLUG } = require("../../scope/reserved");
const { ArtifactError } = require("./artifact-errors");
const canvasAdapter = require("./artifact-adapter-canvas");

/** @typedef {{ repo: ReturnType<typeof import("../../db/repos/artifact.repo").createArtifactRepo>, projectsDir: string, actor?: string, fsx?: typeof fs }} OwnershipContext */

/** @param {string} type */
const adapterFor = (type) => (type.startsWith("canvas.") ? canvasAdapter : null);

/** A real project or the personal workspace. Reads only: the personal folder is created when the change is applied. */
const knownDestination = (/** @type {unknown} */ d) => typeof d === "string" && (d === PERSONAL_SLUG || slugs().includes(d));

/**
 * @param {OwnershipContext} ctx @param {string} id @param {unknown} destination @param {"move"|"copy"} mode
 */
function buildPlan(ctx, id, destination, mode) {
  const artifact = ctx.repo.get(id);
  if (!artifact) throw new ArtifactError("NOT_FOUND", "Artefato não encontrado.");
  if (!knownDestination(destination)) throw new ArtifactError("INVALID_OWNER", "Projeto de destino não encontrado.");
  const to = /** @type {string} */ (destination);
  if (mode === "move" && to === artifact.owner) throw new ArtifactError("SAME_OWNER", "O artefato já pertence a este projeto.");
  const adapter = adapterFor(artifact.type);
  if (!adapter) throw new ArtifactError("UNSUPPORTED_TYPE", `Ainda não é possível mover ou copiar artefatos do tipo ${artifact.type}.`);
  const files = ctx.repo.filesOf(id);
  const planned = adapter.plan({ artifact, files, projectsDir: ctx.projectsDir, destination: to, mode });
  const collisions = planned.ops.filter((op) => fs.existsSync(op.to)).map((op) => path.relative(ctx.projectsDir, op.to).replace(/\\/g, "/"));
  const brokenReferences = mode === "move" ? adapter.references({ artifact, files, projectsDir: ctx.projectsDir }) : [];
  return { artifact, adapter, files, planned, collisions, brokenReferences, links: ctx.repo.findReferences(id), destination: to };
}

/** What the user sees before confirming. @param {ReturnType<typeof buildPlan>} p @param {"move"|"copy"} mode */
function describePlan(p, mode) {
  return {
    id: p.artifact.id,
    type: p.artifact.type,
    title: p.artifact.title,
    mode,
    from: p.artifact.owner,
    to: p.destination,
    files: p.planned.destFiles.map((f) => f.path),
    collisions: p.collisions,
    brokenReferences: p.brokenReferences,
    derivatives: p.links.derivatives.map((a) => ({ id: a.id, owner: a.owner, title: a.title })),
    canProceed: p.collisions.length === 0,
  };
}

module.exports = { buildPlan, describePlan, adapterFor, knownDestination };

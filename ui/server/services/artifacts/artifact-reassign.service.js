// @ts-check
// Move an artifact to another owner, preview it, undo it, or copy it (EP-25.04, ADR-019 item 5).
// Files move inside the database transaction and are put back if any step fails, so the artifact is either
// fully at the origin or fully at the destination. Moving requires an explicit `confirmado: true`.
const path = require("path");
const { PERSONAL_SLUG } = require("../../scope/reserved");
const { ensurePersonalWorkspace } = require("../../scope/personal-workspace");
const { applyOps } = require("./artifact-fs-ops");
const { hashFile } = require("./artifact-canvas");
const { ArtifactError } = require("./artifact-errors");
const { buildPlan, describePlan } = require("./artifact-ownership-plan");

/** @typedef {import("./artifact-ownership-plan").OwnershipContext} OwnershipContext */

/** @param {OwnershipContext} ctx @param {string} id @param {unknown} destination @param {"move"|"copy"} [mode] */
function previewOwnership(ctx, id, destination, mode = "move") {
  return describePlan(buildPlan(ctx, id, destination, mode), mode);
}

/** @param {ReturnType<typeof buildPlan>} p */
function refuseCollisions(p) {
  if (p.collisions.length) throw new ArtifactError("COLLISION", "O destino já tem arquivos com o mesmo nome; nada foi alterado.", { collisions: p.collisions });
}

/** @param {OwnershipContext} ctx @param {{ abs: string, path: string }[]} destFiles */
const hashed = (ctx, destFiles) => destFiles.map((f) => ({ path: f.path, contentHash: hashFile(f.abs) }));

/**
 * @param {OwnershipContext} ctx @param {string} id @param {unknown} destination
 * @param {{ confirmado?: unknown, skipConfirmation?: boolean, undoOf?: number|null }} [options]
 */
function reassign(ctx, id, destination, { confirmado, skipConfirmation = false, undoOf = null } = {}) {
  if (!skipConfirmation && confirmado !== true) {
    throw new ArtifactError("CONFIRMATION_REQUIRED", "Mover remove o artefato da origem e exige confirmação explícita.");
  }
  const p = buildPlan(ctx, id, destination, "move");
  refuseCollisions(p);
  if (p.destination === PERSONAL_SLUG) ensurePersonalWorkspace();
  const logId = ctx.repo.transaction(() => {
    const applied = applyOps(p.planned.ops, ctx.fsx);
    try {
      return ctx.repo.setOwner(id, p.destination, {
        files: hashed(ctx, p.planned.destFiles), sourceKey: p.planned.sourceKey, actor: ctx.actor || "web", undoOf,
      });
    } catch (error) {
      applied.rollback();
      throw error;
    }
  });
  p.adapter.afterApply(p.planned);
  return { id, from: p.artifact.owner, to: p.destination, logId };
}

/** Reverts a move, only while it is the latest ownership change and the files are exactly as it left them. */
function undoReassign(/** @type {OwnershipContext} */ ctx, /** @type {string} */ id, /** @type {unknown} */ logId) {
  const entry = typeof logId === "number" ? ctx.repo.getLog(logId) : null;
  if (!entry || entry.artifactId !== id || entry.action !== "move" || entry.undoOf !== null || !entry.from) {
    throw new ArtifactError("UNDO_NOT_ALLOWED", "Este registro não é um movimento que possa ser desfeito.");
  }
  const last = ctx.repo.lastLog(id);
  if (!last || last.id !== entry.id) throw new ArtifactError("UNDO_NOT_ALLOWED", "Houve outras mudanças de dono depois deste movimento.");
  for (const f of entry.snapshot) {
    if (hashFile(path.join(ctx.projectsDir, f.path)) !== f.contentHash) {
      throw new ArtifactError("UNDO_NOT_ALLOWED", "O artefato foi alterado depois de mover; desfazer poderia perder essas mudanças.");
    }
  }
  return reassign(ctx, id, entry.from, { skipConfirmation: true, undoOf: entry.id });
}

/** Copies an artifact: a new id, the original untouched, `derived_from` pointing back. Not destructive, so no confirmation. */
function copyArtifact(/** @type {OwnershipContext} */ ctx, /** @type {string} */ id, /** @type {unknown} */ destination) {
  const p = buildPlan(ctx, id, destination, "copy");
  refuseCollisions(p);
  if (p.destination === PERSONAL_SLUG) ensurePersonalWorkspace();
  const created = ctx.repo.transaction(() => {
    const applied = applyOps(p.planned.ops, ctx.fsx);
    try {
      return ctx.repo.register({
        type: p.artifact.type, owner: p.destination, title: p.artifact.title, files: hashed(ctx, p.planned.destFiles),
        sourceKey: p.planned.sourceKey, derivedFrom: id, actor: ctx.actor || "web", action: "copy",
      }).artifact;
    } catch (error) {
      applied.rollback();
      throw error;
    }
  });
  p.adapter.afterApply(p.planned);
  return { id: created.id, derivedFrom: id, owner: p.destination };
}

module.exports = { previewOwnership, reassign, undoReassign, copyArtifact };

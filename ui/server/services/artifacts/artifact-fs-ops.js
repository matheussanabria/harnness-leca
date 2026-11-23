// @ts-check
// Applies a list of file operations and undoes them all if one fails (EP-25.04 RF2). Never overwrites: an
// existing destination is a COLLISION. `fsx` is injectable so tests can fail the Nth operation.
const fs = require("fs");
const path = require("path");
const { ArtifactError } = require("./artifact-errors");

/** @typedef {{ kind: "move" | "copy", from: string, to: string } | { kind: "write", to: string, content: string }} FileOp */

/** @param {FileOp} op @param {typeof fs} fsx */
function undoOp(op, fsx) {
  if (op.kind === "move") fsx.renameSync(op.to, op.from);
  else fsx.rmSync(op.to, { recursive: true, force: true });
}

/**
 * @param {FileOp[]} ops
 * @param {typeof fs} [fsx]
 * @returns {{ rollback: () => void }} rollback reverts what was applied (used when the database step fails)
 */
function applyOps(ops, fsx = fs) {
  /** @type {FileOp[]} */
  const done = [];
  const rollback = () => {
    for (const op of done.reverse()) {
      try { undoOp(op, fsx); } catch { /* best effort: keep reverting the rest */ }
    }
    done.length = 0;
  };
  try {
    for (const op of ops) {
      if (fsx.existsSync(op.to)) throw new ArtifactError("COLLISION", "O destino já existe e não será sobrescrito.", { path: op.to });
      fsx.mkdirSync(path.dirname(op.to), { recursive: true });
      if (op.kind === "move") fsx.renameSync(op.from, op.to);
      else if (op.kind === "copy") fsx.cpSync(op.from, op.to, { recursive: true, errorOnExist: true });
      else fsx.writeFileSync(op.to, op.content, { encoding: "utf8", flag: "wx" });
      done.push(op);
    }
  } catch (error) {
    rollback();
    if (error instanceof ArtifactError) throw error;
    throw new ArtifactError("STORAGE", "Não foi possível mover os arquivos; nada foi alterado.");
  }
  return { rollback };
}

module.exports = { applyOps };

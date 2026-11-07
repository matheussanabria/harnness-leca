// @ts-check
// Saves one existing text file of a catalog item. Same path guards as the reader, plus a revision check
// (the hash the editor read) so a change made elsewhere is never overwritten silently.
const fs = require("fs");
const path = require("path");
const { resolveFile, revisionOf, TEXT_EXT, MAX_BYTES } = require("./catalog-files");

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * @param {{kind:string, source:string, ref:string, path:string, content:string, revision:string}} req
 * @param {any} [sources]
 * @returns {{status:number, error?:string, revision?:string, size?:number, currentRevision?:string}}
 */
function writeItemFile(req, sources) {
  if (typeof req.content !== "string") return { status: 400, error: "Missing content." };
  if (!req.revision) return { status: 400, error: "Missing revision." };
  const found = resolveFile(req.kind, req.source, req.ref, req.path, sources);
  if (!found.real) return { status: found.status, error: found.error };
  const { real, stat } = found;
  if (!TEXT_EXT.has(path.extname(real).toLowerCase())) return { status: 400, error: "Only text files can be edited." };
  if (stat.size > MAX_BYTES) return { status: 400, error: "File is too large to edit here." };
  const next = Buffer.from(req.content, "utf8");
  if (next.length > MAX_BYTES) return { status: 400, error: "Content is too large." };
  if (next.includes(0)) return { status: 400, error: "Binary content is not allowed." };

  const current = fs.readFileSync(real);
  if (current.includes(0)) return { status: 400, error: "Only text files can be edited." };
  const currentRevision = revisionOf(current);
  if (currentRevision !== req.revision) {
    return { status: 409, error: "The file changed since you opened it.", currentRevision };
  }
  const out = current.subarray(0, 3).equals(BOM) ? Buffer.concat([BOM, next]) : next;
  const tmp = `${real}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, out, { mode: stat.mode });
    fs.renameSync(tmp, real);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* temp already gone */ }
    return { status: 500, error: `Could not save: ${err.message}` };
  }
  return { status: 200, revision: revisionOf(out), size: out.length };
}

module.exports = { writeItemFile };

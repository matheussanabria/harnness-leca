// @ts-check
const path = require("path");
const { getProjects, read, slugs, send, readJsonBody } = require("../config");
const MR = require("../../../tools/lib/memory-review");

// Revisão das sugestões de memória (tools/lib/memory-review.js): lista o que falta revisar e aplica promover/descartar.
const apiReviewList = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const memoriaBytes = Buffer.byteLength(read(path.join(getProjects(), slug, "memory.md")));
  const migrado = MR.isProjectMigrated(slug);
  return send(res, 200, { pendentes: MR.pending(slug), memoriaBytes, migrado });
};

async function apiReviewApply({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  try {
    const result = MR.apply(slug, body && body.acoes);
    const migrado = MR.isProjectMigrated(slug);
    return send(res, 200, {
      ...result,
      pendentes: MR.pending(slug).length,
      memoriaBytes: Buffer.byteLength(read(path.join(getProjects(), slug, "memory.md"))),
      migrado,
    });
  } catch (err) {
    if (err instanceof MR.ReviewError) return send(res, 400, { error: err.message });
    console.error("[review]", (err && err.stack) || err);
    return send(res, 500, { error: "Não foi possível aplicar a revisão. O detalhe está no terminal do servidor." });
  }
}

module.exports = {
  apiReviewList,
  apiReviewApply,
};

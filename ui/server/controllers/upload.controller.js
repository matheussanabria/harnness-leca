// @ts-check
const fs = require("fs");
const path = require("path");
const { slugs, send, getProjects } = require("../config");

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(png|jpe?g|gif|webp|bmp|heic|heif|pdf|txt|md|csv|json|log|xml|ya?ml|html|css|js|ts|webm|ogg|oga|mp3|m4a|wav|mp4|aac)$/i;

const safeName = (n) =>
  String(n || "arquivo")
    .replace(/[\/]/g, "_")
    .replace(/[^\w.\-À-ÿ ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(-80);

const kindOf = (name) =>
  /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(name) ? "image" : /\.(webm|ogg|oga|mp3|m4a|wav|aac|mp4)$/i.test(name) ? "audio" : "file";

/** POST /api/chat/upload?slug=<slug>&name=<arquivo> com o binário no corpo. Salva em projects/<slug>/context/uploads/. */
async function apiChatUpload({ req, res, url }) {
  const slug = url.searchParams.get("slug") || "";
  const name = safeName(url.searchParams.get("name"));
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  if (!ALLOWED.test(name)) return send(res, 415, { error: "Tipo de arquivo não suportado." });
  if (Number(req.headers["content-length"]) > MAX_BYTES) return send(res, 413, { error: "Arquivo maior que 25 MB." });

  const chunks = [];
  let size = 0;
  try {
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BYTES) return send(res, 413, { error: "Arquivo maior que 25 MB." });
      chunks.push(c);
    }
  } catch {
    return send(res, 400, { error: "Falha ao receber o arquivo." });
  }
  if (!size) return send(res, 400, { error: "Arquivo vazio." });

  const dir = path.join(getProjects(), slug, "context", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}`);
  fs.writeFileSync(file, Buffer.concat(chunks));
  return send(res, 200, { ok: true, name, path: file, size, kind: kindOf(name) });
}

module.exports = { apiChatUpload };

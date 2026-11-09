// @ts-check
const fs = require("fs");
const path = require("path");
const { PUBLIC, TYPES, inside, send } = require("../config");

function resolveMermaidBundle() {
  try {
    return require.resolve("mermaid/dist/mermaid.min.js");
  } catch {
    const fallback = path.resolve(__dirname, "../../../node_modules/mermaid/dist/mermaid.min.js");
    return fs.existsSync(fallback) ? fallback : "";
  }
}

const MERMAID_BUNDLE = resolveMermaidBundle();

function serveStatic(res, p) {
  if (p === "/js/vendor/mermaid.min.js" && MERMAID_BUNDLE && fs.existsSync(MERMAID_BUNDLE)) {
    return send(res, 200, fs.readFileSync(MERMAID_BUNDLE), "application/javascript");
  }
  // /overview, /deploy, /escritorio e /office sem .html, para o endereco ficar limpo.
  const rel = p === "/" ? "index.html" : p === "/overview" ? "overview.html" : p === "/diario" ? "diario.html" : p === "/consumo" ? "consumo.html" : (p === "/catalogo" || p.startsWith("/catalogo/")) ? "catalogo.html" : p === "/deploy" ? "deploy.html" : (p === "/escritorio" || p === "/office") ? "office.html" : p.replace(/^[\/\\]+/, "");
  const file = path.resolve(PUBLIC, "." + path.sep + rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (type && file.startsWith(PUBLIC + path.sep) && inside(PUBLIC, file)) {
    const runtimeAsset = rel.replace(/\\/g, "/").startsWith("js/vendor/dc-runtime/");
    const headers = runtimeAsset ? { "Cross-Origin-Resource-Policy": "cross-origin" } : {};
    return send(res, 200, fs.readFileSync(file), type, headers);
  }
  return send(res, 404, "404", "text/plain");
}

module.exports = {
  serveStatic,
};

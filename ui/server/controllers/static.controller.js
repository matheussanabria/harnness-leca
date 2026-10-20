// @ts-check
const fs = require("fs");
const path = require("path");
const { PUBLIC, TYPES, inside, send } = require("../config");

function serveStatic(res, p) {
  // /overview, /deploy, /escritorio e /office sem .html, para o endereço ficar limpo.
  const rel = p === "/" ? "index.html" : p === "/overview" ? "overview.html" : p === "/diario" ? "diario.html" : p === "/deploy" ? "deploy.html" : (p === "/escritorio" || p === "/office") ? "office.html" : p.replace(/^[\/\\]+/, "");
  const file = path.resolve(PUBLIC, "." + path.sep + rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (type && file.startsWith(PUBLIC + path.sep) && inside(PUBLIC, file)) {
    return send(res, 200, fs.readFileSync(file), type);
  }
  return send(res, 404, "404", "text/plain");
}

module.exports = {
  serveStatic,
};

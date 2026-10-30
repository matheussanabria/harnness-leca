// @ts-check
// Minimal glob for the `paths` field: `**` crosses folders, `*` and `?` stay inside one path segment.
"use strict";

const toPosix = (p) => p.replace(/\\/g, "/");

function globToRegExp(glob) {
  let re = "";
  const g = toPosix(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** A glob without wildcards also matches everything inside that folder (`ui/server/` or `ui/server`). */
function matchesGlob(glob, file) {
  const f = toPosix(file);
  if (!/[*?]/.test(glob)) {
    const base = toPosix(glob).replace(/\/$/, "");
    return f === base || f.startsWith(`${base}/`);
  }
  return globToRegExp(glob).test(f);
}

module.exports = { matchesGlob, toPosix };

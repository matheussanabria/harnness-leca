// @ts-check
"use strict";
const fs = require("fs");
const path = require("path");
const { resolveProjectDesignProfile } = require("./design-profile-resolver.service");

/**
 * Context for the Atelier quality prompt. Opt-in per project through `design/profile.json`
 * (`"atelier": { "qualityPrompt": true }`). When the flag is on but the Design System was not imported,
 * the result says so instead of silently falling back to something else.
 * @param {string} projectDir projects/<slug>
 * @returns {{ enabled: boolean, reason?: string, index?: string, tokensCss?: string }}
 */
function loadQualityContext(projectDir, deps = { fs, path }) {
  const profile = resolveProjectDesignProfile(projectDir, "", deps);
  if (profile.atelier?.qualityPrompt !== true) return { enabled: false, reason: "flag-off" };

  const dsDir = deps.path.join(projectDir, "design", "ds");
  const read = (name) => {
    try { return deps.fs.readFileSync(deps.path.join(dsDir, name), "utf8"); } catch { return ""; }
  };
  const index = read("ds-index.md");
  const tokensCss = read("tokens.css");
  if (!index || !tokensCss) return { enabled: false, reason: "design-system-missing" };
  return { enabled: true, index, tokensCss };
}

module.exports = { loadQualityContext };

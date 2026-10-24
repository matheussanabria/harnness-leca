// @ts-check
"use strict";
const fs = require("fs");
const path = require("path");
const { resolveProjectDesignProfile } = require("./design-profile-resolver.service");

/** Components whose full markup and CSS go into the prompt when the profile does not choose a kit. */
const DEFAULT_KIT = ["button", "icon", "header", "footer", "badge", "cards", "accordion", "alert", "form"];

/** Kit ids from the profile (`atelier.kit`), restricted to safe folder names. */
function kitIds(profile) {
  const chosen = profile.atelier?.kit;
  const ids = Array.isArray(chosen) ? chosen : DEFAULT_KIT;
  return ids.filter((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id));
}

/**
 * Context for the Atelier quality prompt. Opt-in per project through `design/profile.json`
 * (`"atelier": { "qualityPrompt": true }`). When the flag is on but the Design System was not imported,
 * the result says so instead of silently falling back to something else.
 * @param {string} projectDir projects/<slug>
 * @returns {{ enabled: boolean, reason?: string, index?: string, tokensCss?: string, kit?: Array<{id: string, html: string, css: string}> }}
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
  const kit = [];
  for (const id of kitIds(profile)) {
    const html = read(`components/${id}/${id}.html`).trim();
    const css = read(`components/${id}/${id}.css`).trim();
    if (html) kit.push({ id, html, css });
  }
  return { enabled: true, index, tokensCss, kit };
}

/**
 * Metadata for savePrototypeFiles: prototypes saved under the quality prompt ask the sandbox to load the
 * Design System component CSS. Without it, component classes the prompt tells the model to use render unstyled.
 * @param {string} projectDir
 * @returns {{ dsComponents?: true }}
 */
function qualityMetadata(projectDir, deps = { fs, path }) {
  return loadQualityContext(projectDir, deps).enabled ? { dsComponents: true } : {};
}

module.exports = { loadQualityContext, qualityMetadata };

// @ts-check
// Where a feature dossier lives and how it is named. Pure path logic plus config reads; never writes.
// Default: <project repo>/docs/features/<feature-slug>/ (EP-18 convention). A project can override the folder
// with projects/<slug>/dossier.json { "dir": "doc/sistema/features" } (relative to its repo).
// Without a configured repo the dossier stays inside the harness project: projects/<slug>/dossies/<feature-slug>/.
const fs = require("fs");
const path = require("path");

const DEFAULT_DIR = "docs/features";
const FALLBACK_DIR = "dossies";

/** @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

/** Relative path without traversal or absolute parts; "" when unsafe. @param {unknown} value */
function safeRelative(value) {
  const rel = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!rel || /(^|\/)\.\.(\/|$)/.test(rel) || /^[a-zA-Z]:/.test(rel)) return "";
  return rel;
}

/** ASCII kebab-case, at most `max` chars. @param {string} text @param {number} [max] */
function slugify(text, max = 40) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/**
 * Feature folder name: <story-key>-<seed words> or <yyyymmdd>-<seed words>.
 * @param {{ storyKey?: string, seed?: string, now?: Date }} input
 */
function featureSlug({ storyKey, seed, now = new Date() }) {
  const words = slugify(seed || "", 40);
  const head = slugify(storyKey || "", 40) || now.toISOString().slice(0, 10).replace(/-/g, "");
  return words ? `${head}-${words}` : head;
}

/**
 * Root folder that holds the dossiers of a project.
 * @param {string} projectDir projects/<slug>
 * @returns {{ root: string, rel: string, repo: string, source: "project" | "repo" | "harness" }}
 */
function resolveDossierRoot(projectDir) {
  let repo = "";
  for (const name of ["mcp.json", "app.json"]) {
    const cfg = readJson(path.join(projectDir, name));
    if (!repo && cfg && typeof cfg.repo === "string") repo = cfg.repo;
  }
  if (repo && fs.existsSync(repo)) {
    const custom = safeRelative(readJson(path.join(projectDir, "dossier.json"))?.dir);
    const rel = custom || DEFAULT_DIR;
    return { root: path.join(repo, rel), rel, repo, source: custom ? "project" : "repo" };
  }
  return { root: path.join(projectDir, FALLBACK_DIR), rel: FALLBACK_DIR, repo: "", source: "harness" };
}

/** True when `target` is inside `root` (no escape through `..`). @param {string} root @param {string} target */
function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

module.exports = { DEFAULT_DIR, FALLBACK_DIR, safeRelative, slugify, featureSlug, resolveDossierRoot, isInside };

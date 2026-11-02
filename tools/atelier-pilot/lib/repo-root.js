// @ts-check
"use strict";
/** Locates the main checkout from inside a git worktree (worktrees have no node_modules and no gitignored projects/). */
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = path.resolve(__dirname, "..", "..", "..");

/** Root of the main checkout: the parent of the shared git dir, or this checkout when git is unavailable. */
function mainRepoRoot() {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: HERE, encoding: "utf8" }).trim();
    return path.dirname(common);
  } catch {
    return HERE;
  }
}

/** Checkout that holds projects/<slug>: this one, else the main checkout (projects/ is gitignored, so worktrees lack it). */
function projectRoot(slug) {
  return require("fs").existsSync(path.join(HERE, "projects", slug)) ? HERE : mainRepoRoot();
}

module.exports = { HERE, mainRepoRoot, projectRoot };

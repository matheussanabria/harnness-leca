// @ts-check
"use strict";
// Port of the engine host per checkout (EP-23.07). The main checkout keeps 4322. Any other checkout (a git worktree)
// gets its own port in 4400-4499, derived from its folder, so a test server started from a worktree never lands on the
// port of the main checkout's host (hosts of different checkouts have different tokens and could not talk to each other).
// Pure apart from `checkoutKind`, which runs git through an injectable function.
const path = require("path");
const { execFileSync } = require("child_process");

const DEFAULT_PORT = 4322;
const RANGE_START = 4400;
const RANGE_SIZE = 100;

/** Same folder, same text, whatever the spelling (case, slashes, trailing slash). @param {string} root */
const normalise = (root) => path.resolve(root).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** FNV-1a, 32 bit: small, stable and good enough to spread folder names over 100 ports. @param {string} text */
function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * @param {string} root checkout folder
 * @param {"main" | "linked" | "unknown"} kind "unknown" (git did not answer) behaves like the main checkout: 4322
 * @returns {number}
 */
function checkoutPort(root, kind) {
  if (kind !== "linked") return DEFAULT_PORT;
  return RANGE_START + (stableHash(normalise(root)) % RANGE_SIZE);
}

/**
 * Main checkout or linked worktree, from git: both directories are the same only in the main checkout.
 * @param {string} root @param {(args: string[]) => string} [runGit]
 * @returns {"main" | "linked" | "unknown"}
 */
function checkoutKind(root, runGit) {
  const git = runGit || ((/** @type {string[]} */ args) => {
    // A call made from a git hook inherits GIT_DIR and friends, which would point at the wrong repository.
    const env = { ...process.env };
    for (const name of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"]) delete env[name];
    return execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  });
  try {
    const dir = path.resolve(root, git(["rev-parse", "--git-dir"]).trim());
    const common = path.resolve(root, git(["rev-parse", "--git-common-dir"]).trim());
    return dir === common ? "main" : "linked";
  } catch {
    return "unknown";
  }
}

/** The environment variable always wins (tests use 0 to get a free port). @param {{ env: NodeJS.ProcessEnv, root: string, kind: () => "main" | "linked" | "unknown" }} input */
function resolveHostPort({ env, root, kind }) {
  const raw = env.HARNESS_ENGINE_HOST_PORT;
  if (raw !== undefined && raw !== "" && Number.isInteger(Number(raw))) return Number(raw);
  return checkoutPort(root, kind());
}

module.exports = { DEFAULT_PORT, RANGE_START, RANGE_SIZE, checkoutPort, checkoutKind, resolveHostPort, stableHash };

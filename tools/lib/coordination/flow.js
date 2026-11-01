// @ts-check
// Multi-agent Scrum flow around the ledger: one worktree per claimed story, parallel sprint waves,
// delegation of the implementation to OpenCode, and a completion check that demands committed work.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { git, createWorktree } = require("../opencode-package/worktree");
const { delegate } = require("../opencode-delegate");
const { findConflicts } = require("./scopes");

const DEFAULT_COMBO = "9router/harness-implementacao";

/** "opencode/qualidade" + "EP-14.03" -> "agent/opencode/qualidade/EP-14.03" */
const branchFor = (/** @type {string} */ provider, /** @type {string} */ storyId) => `agent/${provider}/${storyId}`;

/**
 * Creates the story worktree (off `base`) that the claim will record in the ledger.
 * @returns {{ dir: string, branch: string }}
 */
function openWorktree(root, provider, storyId, base = "main") {
  const branch = branchFor(provider, storyId);
  const wt = createWorktree(root, { id: storyId, branch, base });
  return { dir: wt.dir, branch };
}

/**
 * Completion needs committed work: a clean tree and at least one commit past `base`. Returns the SHA for the evidence.
 * @param {{ dir: string, branch: string }} worktree
 */
function assertCommitted(worktree, base = "main") {
  const dirty = git(["status", "--porcelain", "-uall"], worktree.dir);
  if (!dirty.ok) throw new Error(`git status falhou em ${worktree.dir}: ${dirty.err.slice(0, 200)}`);
  if (dirty.out) throw new Error(`Worktree ${worktree.dir} tem alteracoes sem commit; commite antes de concluir.`);
  const ahead = git(["rev-list", "--count", `${base}..HEAD`], worktree.dir);
  if (!ahead.ok || Number(ahead.out) < 1) throw new Error(`Branch ${worktree.branch} nao tem commits alem de ${base}.`);
  return git(["rev-parse", "--short", "HEAD"], worktree.dir).out;
}

/**
 * Groups stories into waves that can run in parallel: a story waits for its unfinished dependencies and
 * never shares a wave with a story whose file scopes overlap. Stories with no scope run alone (unbounded).
 * @param {Record<string, any>} stories ledger stories
 * @param {string[]} ids stories chosen for the sprint
 */
function planWaves(stories, ids) {
  const chosen = ids.map((id) => {
    if (!stories[id]) throw new Error(`Historia desconhecida: ${id}`);
    return stories[id];
  });
  const pending = new Set(chosen.filter((s) => s.status !== "done").map((s) => s.id));
  const done = new Set(Object.values(stories).filter((s) => s.status === "done").map((s) => s.id));
  const waves = [];
  const unscoped = [];
  while (pending.size) {
    const ready = [...pending].map((id) => stories[id]).filter((s) => s.dependencies.every((d) => done.has(d)));
    if (!ready.length) throw new Error(`Dependencias circulares ou fora do sprint: ${[...pending].join(", ")}.`);
    /** @type {any[]} */
    const wave = [];
    for (const story of ready) {
      if (wave.some((w) => !w.fileScopes.length)) break; // an unscoped story already owns this wave
      if (!story.fileScopes.length) {
        if (wave.length) continue; // runs alone, in a later wave
        wave.push(story);
        unscoped.push(story.id);
      } else if (!findConflicts([...wave, story]).length) wave.push(story);
    }
    waves.push(wave.map((s) => s.id));
    for (const s of wave) { pending.delete(s.id); done.add(s.id); }
  }
  return { waves, unscoped };
}

/** Prompt for the executor: the story document plus the guard rails of the repository. */
function buildStoryPrompt(root, story) {
  const file = story.document ? path.resolve(root, "docs", "harness-evolution", story.document) : null;
  const doc = file && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : `# ${story.id}: ${story.title}`;
  return [
    `Implement story ${story.id} in this worktree. Touch only the files listed in the story scope: ${story.fileScopes.join(", ") || "(see story)"}.`,
    "Rules: files under 300 lines, no emojis (FontAwesome icons only), update the map row for any new file, run the relevant node --test suites, do not commit and do not run git add.",
    "When finished, list the files changed and the test command with its result.",
    "", "--- STORY ---", doc,
  ].join("\n");
}

/**
 * Runs the story through OpenCode inside its worktree. Combo runs are audited by the delegate library.
 * @param {{ root: string, story: any, worktree: { dir: string }, model?: string, timeoutMinutes?: number }} req
 * @param {Parameters<typeof delegate>[1]} [deps]
 */
function delegateStory(req, deps) {
  const promptFile = path.join(os.tmpdir(), `hl-prompt-${req.story.id}.md`);
  fs.writeFileSync(promptFile, buildStoryPrompt(req.root, req.story), "utf8");
  try {
    return delegate({ dir: req.worktree.dir, promptFile, write: true, bash: ["node --test*", "git status*", "git diff*"], model: req.model || DEFAULT_COMBO, allowCombo: true, timeoutMinutes: req.timeoutMinutes || 30 }, deps);
  } finally {
    fs.rmSync(promptFile, { force: true });
  }
}

module.exports = { DEFAULT_COMBO, branchFor, openWorktree, assertCommitted, planWaves, buildStoryPrompt, delegateStory };

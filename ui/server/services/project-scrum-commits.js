// @ts-check
// Evidencia de commits por historia: le apenas o historico git, nunca escreve nem usa shell.
const fs = require("fs");
const { spawnSync } = require("child_process");

const STORY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const FIELD_SEPARATOR = "\x1f";
const RECORD_SEPARATOR = "\x1e";
const MAX_BUFFER = 16 * 1024 * 1024;
const DEFAULT_MAX_COUNT = 500;
const DEFAULT_TIMEOUT_MS = 10000;
const LOG_FORMAT = "--format=%H%x1f%an%x1f%aI%x1f%cI%x1f%s%x1f%B%x1e";

/** Copia o ambiente sem variaveis GIT_ herdadas de hooks. */
function cleanEnv() {
  const env = {};
  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (!key.startsWith("GIT_") && typeof value === "string") env[key] = value;
  }
  env.GIT_OPTIONAL_LOCKS = "0";
  env.LC_ALL = "C";
  return env;
}

function runGit(repoDir, args, env, timeoutMs, input) {
  return spawnSync("git", args, {
    cwd: repoDir,
    shell: false,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
    env,
    input,
  });
}

function failure(reason) {
  return { available: false, reason, commits: [], byStory: {} };
}

/** spawnSync devolve Error com code (ETIMEDOUT, ENOENT...), que o tipo Error nao declara. */
function isTimeout(error) {
  return /** @type {NodeJS.ErrnoException} */ (error).code === "ETIMEDOUT";
}

/** Ultimo paragrafo so conta como trailer quando todas as linhas sao "Chave: valor". */
function parseTrailers(message) {
  const none = { story: [] };
  if (typeof message !== "string" || message.trim() === "") return none;
  const lines = message.replace(/\r\n?/g, "\n").split("\n");
  let index = lines.length - 1;
  while (index >= 0 && lines[index].trim() === "") index -= 1;
  const paragraph = [];
  while (index >= 0 && lines[index].trim() !== "") {
    paragraph.unshift(lines[index]);
    index -= 1;
  }
  const entries = [];
  for (const line of paragraph) {
    const text = line.trim();
    if (text === "" || text.startsWith("#")) continue;
    const match = /^([A-Za-z0-9-]+):[ \t]*(.*)$/.exec(text);
    if (!match) return none;
    entries.push([match[1].toLowerCase(), match[2].trim()]);
  }
  if (entries.length === 0) return none;
  const story = [];
  for (const [key, value] of entries) {
    if (key !== "story" || value === "" || story.includes(value)) continue;
    story.push(value);
  }
  return { story };
}

function isDirectory(repoDir) {
  if (typeof repoDir !== "string" || repoDir.trim() === "") return false;
  try {
    return fs.statSync(repoDir).isDirectory();
  } catch (error) {
    return false;
  }
}

function requestedIds(storyIds) {
  const ids = [];
  const seen = new Set();
  for (const value of Array.isArray(storyIds) ? storyIds : []) {
    if (typeof value !== "string" || !STORY_ID_PATTERN.test(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(value);
  }
  return ids;
}

function clampCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_COUNT;
  return Math.min(2000, Math.max(1, parsed));
}

function resolveTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TIMEOUT_MS;
}

/** Marca como verificados apenas os objetos que o git reconhece como commit. */
function verifyCommits(repoDir, commits, env, timeoutMs) {
  const shas = commits.map((commit) => commit.sha).filter((sha) => SHA_PATTERN.test(sha));
  if (shas.length === 0) return;
  const result = runGit(repoDir, ["cat-file", "--batch-check"], env, timeoutMs, `${shas.join("\n")}\n`);
  if (result.error || result.status !== 0) return;
  const verified = new Set();
  for (const line of String(result.stdout || "").split("\n")) {
    const match = /^([0-9a-f]{40}) commit \d+$/.exec(line.trim());
    if (match) verified.add(match[1]);
  }
  for (const commit of commits) commit.verified = verified.has(commit.sha);
}

/** Le os commits que carregam trailer Story; qualquer falha esperada vira available: false. */
function readStoryCommits(repoDir, storyIds, options) {
  if (!isDirectory(repoDir)) return failure("no-repo");
  const ids = requestedIds(storyIds);
  if (ids.length === 0) return { available: true, commits: [], byStory: {} };
  const settings = options && typeof options === "object" ? options : {};
  const maxCount = clampCount(settings.maxCount);
  const timeoutMs = resolveTimeout(settings.timeoutMs);
  const env = cleanEnv();

  const inside = runGit(repoDir, ["rev-parse", "--is-inside-work-tree"], env, timeoutMs);
  if (inside.error) return failure(isTimeout(inside.error) ? "timeout" : "git-unavailable");
  if (inside.status !== 0 || String(inside.stdout || "").trim() !== "true") return failure("not-a-git-repo");

  const log = runGit(repoDir, ["log", "--all", "-n", String(maxCount), LOG_FORMAT], env, timeoutMs);
  if (log.error) return failure(isTimeout(log.error) ? "timeout" : "git-error");
  if (log.status !== 0) return failure("git-error");

  const wanted = new Map(ids.map((id) => [id.toLowerCase(), id]));
  const commits = [];
  for (const raw of String(log.stdout || "").split(RECORD_SEPARATOR)) {
    const record = raw.replace(/^\n+/, "");
    if (record.trim() === "") continue;
    const parts = record.split(FIELD_SEPARATOR);
    if (parts.length < 6) continue;
    const matched = [];
    for (const story of parseTrailers(parts.slice(5).join(FIELD_SEPARATOR)).story) {
      const original = wanted.get(story.toLowerCase());
      if (original && !matched.includes(original)) matched.push(original);
    }
    if (matched.length === 0) continue;
    commits.push({
      sha: parts[0],
      shortSha: parts[0].slice(0, 7),
      subject: parts[4],
      authorName: parts[1],
      authoredAt: parts[2],
      committedAt: parts[3],
      storyIds: matched,
      source: "git",
      verified: false,
    });
  }

  verifyCommits(repoDir, commits, env, timeoutMs);

  const byStory = {};
  for (const commit of commits) {
    for (const id of commit.storyIds) {
      if (!Object.prototype.hasOwnProperty.call(byStory, id)) byStory[id] = [];
      byStory[id].push(commit.sha);
    }
  }
  return { available: true, commits, byStory };
}

module.exports = { STORY_ID_PATTERN, parseTrailers, readStoryCommits };

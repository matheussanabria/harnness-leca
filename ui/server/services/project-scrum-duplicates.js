// @ts-check
// Duplicate suggestions for a story being captured. Pure: no I/O, no mutation. A suggestion never blocks creation.

const DUPLICATE_THRESHOLD = 0.6;
const MAX_CANDIDATES = 5;
const MAX_TITLE_LENGTH = 200;

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "para", "por", "com", "que", "ao", "the", "an", "of", "to", "in", "on", "for", "and", "or", "with", "is", "be",
]);

/** @param {unknown} value @returns {string} lowercase, no accents, no punctuation, no stopwords, single spaces */
function normalizeTitle(value) {
  return tokenize(value).join(" ");
}

/** @param {unknown} value @returns {string[]} */
function tokenize(value) {
  return String(value ?? "")
    .slice(0, MAX_TITLE_LENGTH)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

/** @param {string[]} left @param {string[]} right */
function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** @param {unknown} value */
function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * @param {any[]} stories stories already in the store
 * @param {{ title?: unknown, key?: unknown, dedupeKey?: unknown }} candidate
 * @returns {{ id: string, key: string, title: string, reason: string, score: number }[]}
 */
function findDuplicateCandidates(stories, candidate) {
  const key = normalizeKey(candidate.key);
  const dedupeKey = normalizeKey(candidate.dedupeKey);
  const tokens = tokenize(candidate.title);
  const normalized = tokens.join(" ");
  const found = [];
  for (const story of Array.isArray(stories) ? stories : []) {
    const match = classify(story, { key, dedupeKey, tokens, normalized });
    if (match) found.push({ id: story.id, key: story.key, title: story.title, ...match });
  }
  return found.sort((x, y) => y.score - x.score).slice(0, MAX_CANDIDATES);
}

function classify(story, { key, dedupeKey, tokens, normalized }) {
  if (dedupeKey && normalizeKey(story.dedupeKey) === dedupeKey) return { reason: "dedupeKey", score: 1 };
  if (key && (normalizeKey(story.key) === key || normalizeKey(story.id) === key)) return { reason: "key", score: 1 };
  const storyTokens = tokenize(story.title);
  if (normalized && storyTokens.join(" ") === normalized) return { reason: "title", score: 1 };
  const score = jaccard(tokens, storyTokens);
  if (score >= DUPLICATE_THRESHOLD) return { reason: "similar-title", score: Math.round(score * 100) / 100 };
  return null;
}

module.exports = { DUPLICATE_THRESHOLD, MAX_CANDIDATES, MAX_TITLE_LENGTH, normalizeTitle, findDuplicateCandidates };

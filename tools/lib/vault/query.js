// @ts-check
// Ranks vault notes for a keyword query and estimates what opening them would cost in tokens.
"use strict";

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const estimateTokens = (bytes) => Math.ceil(bytes / 4);

function scoreNote(note, words) {
  const fields = [
    [norm(note.title), 5],
    [norm(note.tags.join(" ")), 3],
    [norm(["area", "dominio", "tema", "subtema", "tipo_entidade"].map((k) => note.meta[k] || "").join(" ")), 3],
    [norm(note.rel), 2],
  ];
  let score = 0;
  for (const w of words) for (const [text, weight] of fields) if (text.includes(w)) score += weight;
  return score;
}

/** Returns up to `limit` substantive notes, best first. Stubs (index pages with no content) are skipped. */
function findNotes(notes, query, limit = 5) {
  const words = norm(query).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  return notes
    .filter((n) => !n.stub)
    .map((n) => ({ note: n, score: scoreNote(n, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.note.bytes - b.note.bytes)
    .slice(0, limit);
}

function vaultStats(notes) {
  const real = notes.filter((n) => !n.stub);
  const sum = (list) => list.reduce((t, n) => t + n.bytes, 0);
  return { total: notes.length, stubs: notes.length - real.length, substantive: real.length, substantiveTokens: estimateTokens(sum(real)) };
}

module.exports = { findNotes, vaultStats, estimateTokens, norm };

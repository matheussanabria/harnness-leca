// @ts-check
// Lookups over the map entries: file or keyword to the map file that covers it, and the generated index table.
"use strict";
const { matchesGlob, toPosix } = require("./glob");

const list = (v) => (Array.isArray(v) ? v : []);
const migrated = (entries) => entries.filter((e) => e.meta);

/** By file: entries whose `paths` cover it (most specific glob first). By keyword: ranked by field hits. */
function findMapa(entries, query) {
  const q = toPosix(query.trim());
  if (!q) return [];
  if (/[/.]/.test(q)) {
    const hits = migrated(entries).flatMap((e) => {
      const globs = list(e.meta.paths).filter((g) => matchesGlob(g, q));
      return globs.length ? [{ entry: e, score: Math.max(...globs.map((g) => g.length)) }] : [];
    });
    return hits.sort((a, b) => b.score - a.score).map((h) => h.entry);
  }
  const words = q.toLowerCase().split(/\s+/);
  const scored = migrated(entries).map((e) => {
    const fields = [[e.meta.feature, 3], [e.meta.module, 3], [e.meta.domain, 2], [list(e.meta.keywords).join(" "), 2], [e.meta.summary, 1]];
    const score = words.reduce((s, w) => s + fields.reduce((t, [text, weight]) => t + (String(text || "").toLowerCase().includes(w) ? weight : 0), 0), 0);
    return { entry: e, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.entry);
}

/** Markdown index table for MAPA.md, regenerated from the frontmatter so sizes never go stale. */
function buildIndex(entries) {
  const rows = migrated(entries).map((e) => {
    const m = e.meta;
    return `| \`${e.file.replace(/^docs\/mapa\//, "")}\` | ${m.domain} / ${m.module} | ${m.summary} | ${(e.size / 1024).toFixed(1)} KB |`;
  });
  return ["| File | Domain / module | Covers | Size |", "|---|---|---|---|", ...rows].join("\n");
}

/** Domain-level table for MAPA.md: one row per domain with its modules, file count and total size. */
function buildDomainTable(entries) {
  const byDomain = new Map();
  for (const e of migrated(entries)) {
    const d = byDomain.get(e.meta.domain) || { files: 0, size: 0, modules: new Set() };
    d.files += 1;
    d.size += e.size;
    d.modules.add(e.meta.module);
    byDomain.set(e.meta.domain, d);
  }
  const rows = [...byDomain].sort(([a], [b]) => a.localeCompare(b)).map(([name, d]) =>
    `| \`${name}\` | ${[...d.modules].sort().join(", ")} | ${d.files} | ${(d.size / 1024).toFixed(1)} KB |`);
  return ["| Domain | Modules | Files | Size |", "|---|---|---|---|", ...rows].join("\n");
}

module.exports = { findMapa, buildIndex, buildDomainTable };

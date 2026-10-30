// @ts-check
// Rules for the map tree. Errors fail the check; warnings are reported (files not migrated yet, orphans) and become
// errors with `strict`, which is the target state once the migration to docs/mapa/<domain>/<module>/ is finished.
"use strict";
const fs = require("fs");
const path = require("path");
const { validateFrontmatter } = require("./frontmatter");
const { matchesGlob } = require("./glob");

const LIMITS = { area: 8 * 1024, index: 8 * 1024 };

/**
 * @param {{ file: string, size: number, meta: Record<string, string | string[]> | null }[]} entries from scanMapa
 * @param {string[]} covered tracked source files that must be reachable through some `paths` glob (orphan check)
 * @param {{ indexSize?: number, strict?: boolean, limits?: { area: number, index: number }, tracked?: string[] }} [opts] tracked: every tracked file, the target of the dead-link check (defaults to covered)
 */
function checkMapa(entries, covered, opts = {}) {
  const limits = opts.limits || LIMITS;
  const tracked = opts.tracked || covered;
  const errors = [];
  const warnings = [];
  const globs = [];

  if (opts.indexSize !== undefined && opts.indexSize > limits.index) errors.push(`MAPA.md: ${opts.indexSize} bytes, over the ${limits.index} limit`);

  for (const { file, size, meta } of entries) {
    const oversize = size > limits.area ? `${file}: ${size} bytes, over the ${limits.area} limit` : null;
    if (!meta) { warnings.push(`${file}: no frontmatter (not migrated)${oversize ? `, ${size} bytes` : ""}`); continue; }
    if (oversize) errors.push(oversize);
    const parts = file.replace(/^docs\/mapa\//, "").split("/");
    if (parts.length < 3) errors.push(`${file}: must live in docs/mapa/<domain>/<module>/<feature>.md`);
    else if (parts[0] !== meta.domain || parts[1] !== meta.module) errors.push(`${file}: domain/module in frontmatter do not match the folders`);
    for (const p of validateFrontmatter(meta)) errors.push(`${file}: ${p}`);
    for (const g of /** @type {string[]} */ (Array.isArray(meta.paths) ? meta.paths : [])) {
      globs.push(g);
      if (!tracked.some((f) => matchesGlob(g, f))) errors.push(`${file}: path "${g}" matches no tracked file (dead link)`);
    }
  }

  const orphans = covered.filter((f) => !globs.some((g) => matchesGlob(g, f)));
  if (orphans.length) warnings.push(`${orphans.length} tracked file(s) outside every map entry, e.g. ${orphans.slice(0, 5).join(", ")}`);
  if (opts.strict) errors.push(...warnings.splice(0));
  return { errors, warnings, orphans };
}

const indexSize = (root) => fs.statSync(path.join(root, "MAPA.md")).size;

module.exports = { checkMapa, indexSize, LIMITS };

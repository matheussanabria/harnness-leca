// @ts-check
// Agent manifest: the YAML frontmatter of an agent .md file shown as a readable table (name, model, tools...).
import { esc } from "./catalogo-view.js";

/** Reads "key: value" lines of a flat frontmatter; folded values stay on one line. */
export function parseManifest(meta) {
  const rows = [];
  for (const line of String(meta || "").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) rows.push({ key: m[1], value: m[2].replace(/^["']|["']$/g, "") });
    else if (rows.length && line.trim()) rows[rows.length - 1].value += ` ${line.trim()}`;
  }
  return rows;
}

/** Table for an agent; `tools` becomes one chip per tool. Empty string when there is no frontmatter. */
export function renderManifest(meta) {
  const rows = parseManifest(meta);
  if (!rows.length) return "";
  const cell = (r) => r.key === "tools"
    ? r.value.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `<span class="k-tag">${esc(t)}</span>`).join(" ")
    : esc(r.value);
  const body = rows.map((r) => `<tr><th scope="row">${esc(r.key)}</th><td>${cell(r)}</td></tr>`).join("");
  return `<section class="k-manifest"><h4><i class="fa-solid fa-id-card" aria-hidden="true"></i> Manifesto do agente</h4><table>${body}</table></section>`;
}

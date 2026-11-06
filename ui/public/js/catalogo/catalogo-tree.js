// @ts-check
// Pure helpers for the file browser: tree HTML, default file and markdown preparation.
import { esc } from "./catalogo-view.js";

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  return n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

function fileIcon(name) {
  if (/\.(md|markdown|txt)$/i.test(name)) return "fa-regular fa-file-lines";
  if (/\.(ya?ml|json|xml|xsd|toml|ini|py|js|ts|sh|ps1|java|sql|html|css)$/i.test(name)) return "fa-solid fa-file-code";
  return "fa-regular fa-file";
}

/**
 * Nested tree: folders are <details> (the first level starts open), files are buttons.
 * @param {Array<any>} nodes
 * @param {string} selected path of the open file
 * @param {number} [depth]
 */
export function renderTree(nodes, selected, depth = 0) {
  return nodes
    .map((n) => {
      if (n.type === "dir") {
        const open = depth === 0 || (selected && selected.startsWith(n.path + "/")) ? " open" : "";
        return `<details class="k-dir"${open}><summary><i class="fa-solid fa-folder" aria-hidden="true"></i> ${esc(n.name)}</summary>${renderTree(n.children || [], selected, depth + 1)}</details>`;
      }
      const on = n.path === selected ? " is-on" : "";
      return `<button type="button" class="k-file${on}" data-file="${esc(n.path)}" title="${esc(n.path)}"><i class="${fileIcon(n.name)}" aria-hidden="true"></i> <span>${esc(n.name)}</span><small>${fmtSize(n.size || 0)}</small></button>`;
    })
    .join("");
}

/** SKILL.md for a skill, else the first file found (an agent is a single file). */
export function pickDefaultFile(nodes) {
  const files = [];
  const walk = (list) => list.forEach((n) => (n.type === "dir" ? walk(n.children || []) : files.push(n.path)));
  walk(nodes);
  return files.find((p) => /^skill\.md$/i.test(p)) || files.find((p) => /\.md$/i.test(p)) || files[0] || "";
}

/** Drops the YAML frontmatter so the rendered view starts at the content; returns the pieces. */
export function splitFrontmatter(text) {
  const m = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { meta: m[1], body: m[2] } : { meta: "", body: String(text || "") };
}

export function isMarkdown(name) {
  return /\.(md|markdown)$/i.test(name);
}

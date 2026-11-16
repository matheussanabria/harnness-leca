// @ts-check
// Renders one document of doc/ to safe HTML (pure, no DOM): Markdown with marked (vendored, exact version),
// YAML and JSON as a numbered code view. Raw HTML is shown as text, javascript:/data: links are dropped,
// images are not loaded, Mermaid becomes a diagram card (rendered by docs-panel.js with securityLevel strict). Anchors match the server index: headings, rn-<id> on rule
// rows, criterio-<n> on acceptance criteria and L<n> on code lines.
import { Marked } from "../../../vendor/marked-16.4.2/marked.esm.js";
import { esc } from "../../../shared/dom.js";
import { renderMermaidCard } from "../../../shared/markdown-code.js";
import { joinRelative, resolveWikilink, slugify, rnAnchor, criterionAnchor, lineAnchor } from "./docs-paths.js";

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript|file):/i;
const DOC_EXT = /\.(md|ya?ml|json)$/i;

/**
 * @typedef {{ path: string, paths: string[], hrefFor?: (path: string, anchor: string) => string, isAvailable?: (path: string) => boolean }} RenderContext
 * `isAvailable` exists only in the static package: a document of the project left out of it is not a broken link.
 */

/** Text of a Markdown fragment without emphasis, code ticks or links. @param {string} md */
function plain(md) {
  return String(md || "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

/** @param {RenderContext} ctx @param {string} path @param {string} anchor @param {string} inner @param {string} [title] */
function docLink(ctx, path, anchor, inner, title = "") {
  if (ctx.isAvailable && !ctx.isAvailable(path)) {
    return `<span class="doc-link-outside" title="${esc(`${path}: existe no projeto, mas não foi incluído no pacote`)}">${inner} <small>(não incluído no pacote)</small></span>`;
  }
  const href = ctx.hrefFor ? ctx.hrefFor(path, anchor) : "#";
  const t = title ? ` title="${esc(title)}"` : "";
  return `<a class="doc-link" href="${esc(href)}" data-doc-path="${esc(path)}" data-doc-anchor="${esc(anchor)}"${t}>${inner}</a>`;
}

/** @param {string} inner @param {string} why */
const unresolved = (inner, why) => `<span class="doc-link-missing" title="${esc(why)}">${inner}</span>`;

/** Obsidian [[target#anchor|label]] and ![[embed]]. */
function wikilinkExtension(ctx) {
  return {
    name: "wikilink",
    level: "inline",
    start(src) {
      const i = src.indexOf("[[");
      if (i < 0) return undefined;
      return i > 0 && src[i - 1] === "!" ? i - 1 : i;
    },
    tokenizer(src) {
      const m = /^(!?)\[\[([^\]|#\n]*)(?:#([^\]|\n]*))?(?:\|([^\]\n]*))?\]\]/.exec(src);
      if (!m) return undefined;
      return { type: "wikilink", raw: m[0], embed: m[1] === "!", target: m[2].trim(), anchor: (m[3] || "").trim(), label: (m[4] || "").trim() };
    },
    renderer(token) {
      const label = esc(token.label || token.target || token.anchor);
      if (token.embed) return `<span class="doc-embed-missing"><i class="fa-regular fa-image"></i> ${label} (anexo não exibido)</span>`;
      const anchor = token.anchor ? slugify(token.anchor, new Map()) : "";
      const path = token.target ? resolveWikilink(token.target, ctx.path, ctx.paths) : ctx.path;
      return path ? docLink(ctx, path, anchor, label) : unresolved(label, "Documento não encontrado na pasta doc/");
    },
  };
}

/** @param {RenderContext} ctx @param {Map<string, number>} seen */
function buildMarked(ctx, seen) {
  const marked = new Marked({ gfm: true });
  marked.use({
    extensions: [wikilinkExtension(ctx)],
    renderer: {
      heading({ tokens, depth, text }) {
        // @ts-ignore marked binds `this` to the renderer
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${esc(slugify(plain(text), seen))}">${inner}</h${depth}>\n`;
      },
      html({ text }) {
        // Raw HTML stays text; a bare line break (<br>, used inside table cells) is the one exception.
        return /^<br\s*\/?>$/i.test(String(text).trim()) ? "<br>" : esc(text);
      },
      image({ text }) {
        return `<span class="doc-embed-missing"><i class="fa-regular fa-image"></i> ${esc(text || "imagem")} (imagem não exibida)</span>`;
      },
      code({ text, lang }) {
        const kind = String(lang || "").trim().toLowerCase();
        // Mermaid: the Harness diagram card (escaped source; docs-panel.js renders it, "Código" shows the text).
        if (kind === "mermaid") return `${renderMermaidCard({ content: text })}\n`;
        return `<pre class="doc-code-block" data-lang="${esc(kind)}"><code>${esc(text)}</code></pre>\n`;
      },
      link({ href, title, tokens }) {
        // @ts-ignore marked binds `this` to the renderer
        const inner = this.parser.parseInline(tokens);
        const raw = String(href || "");
        if (UNSAFE_SCHEME.test(raw)) return inner;
        if (/^(https?:|mailto:)/i.test(raw)) {
          return `<a class="doc-link-external" href="${esc(raw)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${esc(title)}"` : ""}>${inner} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
        }
        const [file, hash = ""] = raw.split("#");
        if (!file) return docLink(ctx, ctx.path, slugify(hash, new Map()), inner);
        const target = joinRelative(ctx.path, file);
        if (target && DOC_EXT.test(target) && ctx.paths.includes(target)) return docLink(ctx, target, hash, inner, title || "");
        return unresolved(inner, "Fora da documentação disponível no leitor");
      },
    },
  });
  return marked;
}

/** Ids on rule rows and acceptance criteria, matching the server index. @param {string} html */
function addReferenceAnchors(html) {
  const used = new Set();
  const once = (id) => (used.has(id) ? "" : (used.add(id), ` id="${id}"`));
  return html
    .replace(/<tr>(\s*<td[^>]*>\s*(?:<(?:del|s|strong|em|code)>\s*)*(RN-[a-z0-9]+(?:-[a-z0-9]+)*-\d{3})\b)/gi, (_, rest, id) => `<tr${once(rnAnchor(id))}>${rest}`)
    .replace(/<li>(\s*(?:<p>)?\s*(?:<strong>)?\s*Crit[ée]rio\s+(\d+)\b)/gi, (_, rest, n) => `<li${once(criterionAnchor(n))}>${rest}`);
}

/** Frontmatter as a collapsed block of properties. @param {string} yaml */
function renderProperties(yaml) {
  return `<details class="doc-properties"><summary><i class="fa-solid fa-sliders"></i> Propriedades</summary><pre><code>${esc(yaml)}</code></pre></details>`;
}

/** YAML and JSON: one line per row, each with the anchor L<n>. @param {string} text */
export function renderCodeView(text) {
  const rows = String(text || "").split(/\r?\n/).map((line, i) =>
    `<div class="doc-line" id="${lineAnchor(i + 1)}"><span class="doc-ln">${i + 1}</span><span class="doc-lt">${esc(line) || " "}</span></div>`);
  return `<div class="doc-code-view">${rows.join("")}</div>`;
}

/**
 * @param {string} text file content
 * @param {RenderContext} ctx
 * @returns {{ html: string, title: string }}
 */
export function renderDocument(text, ctx) {
  const name = ctx.path.split("/").pop() || ctx.path;
  if (!/\.md$/i.test(ctx.path)) return { html: renderCodeView(text), title: name };
  const source = String(text || "");
  const fm = FRONTMATTER.exec(source);
  const body = fm ? source.slice(fm[0].length) : source;
  const seen = new Map();
  const html = addReferenceAnchors(String(buildMarked(ctx, seen).parse(body)));
  const h1 = /^#\s+([^\r\n]+)/m.exec(body);
  return { html: (fm ? renderProperties(fm[1]) : "") + html, title: h1 ? plain(h1[1]) : name };
}

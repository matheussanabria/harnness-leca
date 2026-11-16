// @ts-check
// The way back from a story to the map and the documentation: when the reader opens a user-story.md, a block lists
// the features the story owns or touches, the screens and fields where it appears on the map, and the trace items
// (criteria, proofs) of rastreio.yml that name it. Pure HTML; the panel handles the clicks.
import { esc } from "../../../shared/dom.js";
import { docHref } from "./docs-location.js";
import { lineAnchor } from "./docs-paths.js";
import { roleLabel } from "./docs-panel-views.js";

/** @param {string} path @param {any} refs @returns {string | null} story id whose user-story.md is `path` */
export function storyIdOf(path, refs) {
  for (const [id, s] of Object.entries(refs?.stories || {})) if (s.path === path) return id;
  return null;
}

/** The story and its other names (a draft placeholder and the number it became). @param {string} id @param {any} refs */
function namesOf(id, refs) {
  const names = new Set([id]);
  if (refs?.aliases?.[id]) names.add(refs.aliases[id]);
  for (const [from, to] of Object.entries(refs?.aliases || {})) if (to === id) names.add(from);
  return names;
}

/**
 * @param {string} id @param {any} refs @param {any[]} screens final screens of the map
 */
export function storyLinks(id, refs, screens) {
  const names = namesOf(id, refs);
  const owner = [];
  const related = [];
  for (const [slug, f] of Object.entries(refs?.features || {})) {
    const link = (f.stories || []).find((s) => names.has(s.id));
    if (!link) continue;
    (/^principal$/i.test(link.role) ? owner : related).push({ slug, title: f.title, role: link.role });
  }

  /** @type {{ screenId: string, title: string, fieldId: string, fieldLabel: string, role: string }[]} */
  const places = [];
  const byId = new Map((screens || []).map((s) => [String(s.id), s]));
  const titleOf = (s) => String(s?.short || s?.title || s?.id || "");
  for (const [screenId, fields] of Object.entries(refs?.fieldStories || {})) {
    const sc = byId.get(screenId);
    if (!sc) continue;
    for (const [fieldId, slot] of Object.entries(/** @type {Record<string, any>} */ (fields))) {
      const role = slot.principal.some((x) => names.has(x)) ? "principal" : slot.relacionadas.some((x) => names.has(x)) ? "relacionada" : "";
      if (!role) continue;
      const field = (sc.fields || []).find((f) => f.id === fieldId);
      places.push({ screenId, title: titleOf(sc), fieldId, fieldLabel: field ? String(field.label || fieldId) : fieldId, role });
    }
  }
  const ownerSlugs = new Set(owner.map((f) => f.slug));
  for (const sc of screens || []) {
    if (sc.feature && ownerSlugs.has(sc.feature) && !places.some((p) => p.screenId === String(sc.id))) {
      places.push({ screenId: String(sc.id), title: titleOf(sc), fieldId: "", fieldLabel: "", role: "tela" });
    }
  }

  const trace = [];
  for (const [traceId, entries] of Object.entries(refs?.trace || {})) {
    for (const e of /** @type {any[]} */ (entries)) if (e.story && names.has(e.story)) trace.push({ id: traceId, ...e });
  }
  trace.sort((a, b) => a.feature.localeCompare(b.feature) || a.line - b.line);
  return { owner, related, places, trace };
}

/** @param {any} p */
function placeChip(p) {
  const label = p.fieldId ? `${p.title} · ${p.fieldLabel}` : p.title;
  const role = p.role === "tela" ? "tela da funcionalidade" : p.role;
  return `<button type="button" class="doc-chip screen-link" data-map-screen="${esc(p.screenId)}" data-map-field="${esc(p.fieldId)}" title="Ver no mapa (${esc(role)})"><i class="fa-solid fa-map-location-dot"></i> ${esc(label)} <small>${esc(role)}</small></button>`;
}

/** @param {any[]} items */
function traceList(items) {
  /** @type {Map<string, any[]>} */
  const byFeature = new Map();
  for (const t of items) byFeature.set(t.feature, [...(byFeature.get(t.feature) || []), t]);
  return [...byFeature].map(([feature, list]) => `<details class="docs-story-trace"><summary>${esc(feature)} <span class="docs-count">${list.length}</span></summary>${list.map((t) =>
    `<a class="docs-nav-item" href="${esc(docHref(t.path, lineAnchor(t.line)))}" data-doc-path="${esc(t.path)}" data-doc-anchor="${esc(lineAnchor(t.line))}"><i class="fa-solid fa-link"></i><span><b>${esc(t.id)}</b> ${esc(t.title || "")}</span></a>`).join("")}</details>`).join("");
}

/**
 * @param {string} id @param {any} refs @param {any[]} screens
 * @returns {string} empty when the story is linked to nothing
 */
export function renderStoryLinks(id, refs, screens) {
  const { owner, related, places, trace } = storyLinks(id, refs, screens);
  if (!owner.length && !related.length && !places.length && !trace.length) return "";
  const feat = (f) => `<button type="button" class="doc-chip" data-doc-feature="${esc(f.slug)}"><i class="fa-solid fa-cubes"></i> ${esc(f.title)} <small>${esc(roleLabel(f.role))}</small></button>`;
  const row = (label, body) => (body ? `<div class="docs-story-row"><span class="docs-strip-label">${label}</span><div class="doc-chip-row">${body}</div></div>` : "");
  return `<section class="docs-story-links" aria-label="Esta história no mapa e na documentação">
    <p class="docs-kicker"><i class="fa-solid fa-arrows-left-right"></i> ${esc(id)} no mapa e na documentação</p>
    ${row("Dona de", owner.map(feat).join(""))}
    ${row("Relacionada a", related.map(feat).join(""))}
    ${row("No mapa", places.map(placeChip).join(""))}
    ${trace.length ? `<div class="docs-story-row"><span class="docs-strip-label">Rastreio (${trace.length})</span><div>${traceList(trace)}</div></div>` : ""}
  </section>`;
}

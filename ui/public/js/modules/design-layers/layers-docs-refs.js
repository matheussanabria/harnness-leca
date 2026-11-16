// @ts-check
// References from a Layers map screen into the project documentation: the "Documentação oficial" strip under
// the tabs, and chips of rules (RN) and stories on rule and field cards. Every chip opens the reader in the side
// panel (docs/docs-panel.js) without leaving the screen. Without the reference index (no doc/) nothing renders.
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { roleLabel, DOC_KIND_LABELS } from "./docs/docs-panel-views.js";
import { openDocRef, openDocsPanel } from "./docs/docs-panel.js";

const RN_RE = /RN-[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}/gi;
const STORY_RE = /\b[A-Z]{2,}-(?:\d+|NOVA-[A-Z0-9-]+)\b/g;
const SAFE_ID = /^[\w#.-]{1,80}$/;
const STRIP_KINDS = ["regras", "bdd", "testes", "rastreio"];

/** Opens a reference from any chip of the workspace. @param {string} kind @param {string} id */
export function openFromChip(kind, id) {
  if (kind === "home") return openDocsPanel();
  if (kind === "missing-list") return openDocsPanel({ type: "missing-list", screen: id });
  return openDocRef(kind, id);
}

/** @param {any} refs @param {string} kind @param {string} id */
function resolves(refs, kind, id) {
  if (kind === "rn") return Boolean(refs.rn?.[id]);
  if (kind === "story") return Boolean(refs.stories?.[id] || refs.aliases?.[id]);
  return true;
}

/** @param {any} refs @param {string} kind @param {string} id */
function chipTitle(refs, kind, id) {
  if (kind === "rn") return refs.rn?.[id]?.text || "";
  if (kind === "story") return refs.stories?.[id]?.title || refs.stories?.[refs.aliases?.[id]]?.title || "";
  return "";
}

/** @type {WeakMap<object, Set<string>>} */
const includedSets = new WeakMap();

/**
 * False only in the static package, for a reference whose document was left out of it (`refs.included`).
 * @param {any} refs @param {string} kind @param {string} id
 */
function inPackage(refs, kind, id) {
  if (!Array.isArray(refs.included)) return true;
  if (!includedSets.has(refs)) includedSets.set(refs, new Set(refs.included));
  const set = /** @type {Set<string>} */ (includedSets.get(refs));
  const p = kind === "rn" ? refs.rn?.[id]?.path : kind === "story" ? (refs.stories?.[id] || refs.stories?.[refs.aliases?.[id]])?.path : null;
  return !p || set.has(p);
}

/**
 * One chip that opens a reference; amber and struck through when the index cannot resolve it, dashed when the
 * document exists but was not included in the static package.
 * @param {string} kind "rn" | "story" | "trace" | "feature" @param {string} id @param {string} [label] @param {string} [extra]
 */
export function docChip(kind, id, label = id, extra = "") {
  const refs = dls.docsRefs;
  if (!refs || !SAFE_ID.test(id)) return "";
  const ok = resolves(refs, kind, id);
  const inside = ok && inPackage(refs, kind, id);
  const icon = kind === "rn" ? "fa-scale-balanced" : kind === "story" ? "fa-book-bookmark" : kind === "feature" ? "fa-cubes" : "fa-link";
  const title = !ok ? `${id} não foi encontrada na documentação (doc/)`
    : !inside ? `${id}: existe no projeto, mas não foi incluído no pacote`
      : chipTitle(refs, kind, id) || `Abrir ${id} na documentação`;
  const cls = !ok ? "doc-chip-missing" : !inside ? "doc-chip-outside" : "";
  return `<button type="button" class="doc-chip ${cls}" title="${esc(title)}" data-doc-ref="${kind}" data-doc-id="${esc(id)}"><i class="fa-solid ${icon}"></i> ${esc(label)}${extra}</button>`;
}

/** Ids of rules and stories written inside a free-text source ("fonte"). @param {string} text */
export function idsInText(text) {
  const t = String(text || "");
  return { rn: [...new Set(t.match(RN_RE) || [])], stories: [...new Set(t.match(STORY_RE) || [])].filter((id) => !/^RN-/i.test(id)) };
}

/** Chips of one rule card: its `rn` plus ids found in `fonte`. @param {any} rule */
export function renderRuleDocChips(rule) {
  if (!dls.docsRefs) return "";
  const fromSrc = idsInText(rule?.src);
  const rn = [...new Set([...(rule?.rn || []), ...fromSrc.rn])];
  const chips = [...rn.map((id) => docChip("rn", id)), ...fromSrc.stories.map((id) => docChip("story", id))].join("");
  return chips ? `<div class="doc-chip-row">${chips}</div>` : "";
}

/** Story chips of one field, from _historias-funcionalidades.json. @param {any} sc @param {any} field */
export function renderFieldStoryChips(sc, field) {
  const slot = dls.docsRefs?.fieldStories?.[sc?.id]?.[field?.id];
  if (!slot) return "";
  const chips = [
    ...slot.principal.map((id) => docChip("story", id, id, " <small>principal</small>")),
    ...slot.relacionadas.map((id) => docChip("story", id)),
  ].join("");
  return chips ? `<div class="doc-chip-row">${chips}</div>` : "";
}

/**
 * What the strip shows for a screen: its feature, the stories (feature and fields) and the other features whose
 * rules the screen cites, by number of citations.
 * @param {any} sc @param {any} refs
 */
export function screenDocs(sc, refs) {
  const feature = sc?.feature && refs?.features?.[sc.feature] ? sc.feature : null;
  /** @type {Map<string, string>} */
  const stories = new Map();
  for (const s of feature ? refs.features[feature].stories : []) stories.set(s.id, roleLabel(s.role));
  for (const slot of Object.values(refs?.fieldStories?.[sc?.id] || {})) {
    for (const id of /** @type {any} */ (slot).principal) if (!stories.has(id)) stories.set(id, "campos");
  }
  /** @type {Map<string, number>} */
  const cited = new Map();
  for (const rule of sc?.rules || []) {
    for (const id of rule.rn || []) {
      const owner = refs?.rn?.[id]?.feature;
      if (owner && owner !== feature) cited.set(owner, (cited.get(owner) || 0) + 1);
    }
  }
  const missing = (refs?.missing || []).filter((m) => m.screen === sc?.id).length;
  return { feature, stories: [...stories], cited: [...cited].sort((a, b) => b[1] - a[1]), missing };
}

/** The "Documentação oficial" strip of the current screen. @param {any} sc */
export function renderScreenDocsBar(sc) {
  const refs = dls.docsRefs;
  if (!refs || !sc) return "";
  const d = screenDocs(sc, refs);
  const f = d.feature ? refs.features[d.feature] : null;
  const docButtons = f ? STRIP_KINDS.filter((k) => f.docs[k]).map((k) =>
    `<button type="button" class="doc-chip doc-chip-quiet" data-doc-ref="doc" data-doc-id="${esc(f.docs[k])}">${esc(DOC_KIND_LABELS[k])}</button>`).join("") : "";
  const group = (label, body) => (body ? `<div class="docs-strip-group"><span class="docs-strip-label">${label}</span>${body}</div>` : "");
  return `
    <div class="docs-strip" aria-label="Documentação oficial da tela">
      <span class="docs-strip-title"><i class="fa-solid fa-book-open"></i> Documentação oficial</span>
      ${group("Funcionalidade", f ? `${docChip("feature", d.feature, f.title)}${docButtons}` : "")}
      ${group("Histórias", d.stories.map(([id, role]) => docChip("story", id, id, ` <small>${esc(role)}</small>`)).join(""))}
      ${group("Regras citadas de", d.cited.map(([slug, n]) => docChip("feature", slug, refs.features[slug]?.title || slug, ` <small>${n}</small>`)).join(""))}
      ${d.missing ? `<button type="button" class="doc-chip doc-chip-missing" data-doc-ref="missing-list" data-doc-id="${esc(sc.id)}"><i class="fa-solid fa-triangle-exclamation"></i> ${d.missing} sem documento</button>` : ""}
      <button type="button" class="docs-strip-open" data-doc-ref="home" data-doc-id=""><i class="fa-solid fa-folder-tree"></i> Navegar na documentação</button>
    </div>`;
}

// One capture listener for every chip outside the panel: it runs before the inline onclick of the field card,
// so clicking a chip opens the document without also selecting the field. The panel handles its own clicks.
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const chip = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.("[data-doc-ref]"));
    if (!chip || chip.closest(".docs-panel")) return;
    e.preventDefault();
    e.stopPropagation();
    void openFromChip(chip.dataset.docRef || "", chip.dataset.docId || "");
  }, true);
}

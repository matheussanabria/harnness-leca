// @ts-check
// HTML of the Documentation panel (pure): the navigation (sections and the whole tree) and the non-document
// views (a feature dossier, a choice between several places, a reference that does not resolve).
import { esc } from "../../../shared/dom.js";
import { docHref } from "./docs-location.js";

export const DOC_KIND_LABELS = {
  status: "Status",
  regras: "Regras",
  bdd: "BDD",
  modelagem: "Modelagem",
  testes: "Testes",
  rastreio: "Rastreio",
  arquivos: "Arquivos",
  mapa: "Mapa em camadas",
};

const ROLE_LABELS = { principal: "principal", secundaria: "secundária", relacionada: "relacionada" };
/** @param {string} role */
export const roleLabel = (role) => ROLE_LABELS[String(role || "").toLowerCase()] || String(role || "");

/** @param {string} path */
const fileName = (path) => path.split("/").pop() || path;

/** @param {string} path @param {string} label @param {string} [anchor] @param {string} [icon] */
export function docItem(path, label, anchor = "", icon = "fa-regular fa-file-lines") {
  return `<a class="docs-nav-item" href="${esc(docHref(path, anchor))}" data-doc-path="${esc(path)}" data-doc-anchor="${esc(anchor)}" title="${esc(path)}" data-filter="${esc(`${label} ${path}`.toLowerCase())}"><i class="${icon}"></i><span>${esc(label)}</span></a>`;
}

/** @param {string} title @param {string} icon @param {string} body @param {number} count @param {boolean} [open] */
function section(title, icon, body, count, open = false) {
  if (!count) return "";
  return `<details class="docs-nav-section"${open ? " open" : ""}><summary><i class="${icon}"></i> ${esc(title)} <span class="docs-count">${count}</span></summary><div class="docs-nav-list">${body}</div></details>`;
}

/** @param {any} f catalog feature */
function featureNav(f) {
  const docs = Object.entries(f.docs || {}).map(([kind, path]) => docItem(path, DOC_KIND_LABELS[kind] || kind));
  const others = (f.others || []).map((p) => docItem(p, fileName(p)));
  const stories = (f.stories || []).map((s) => `<button type="button" class="doc-chip" data-doc-ref="story" data-doc-id="${esc(s.id)}">${esc(s.id)} <small>${esc(roleLabel(s.role))}</small></button>`).join("");
  return `<details class="docs-nav-feature" data-filter="${esc(`${f.title} ${f.slug}`.toLowerCase())}"><summary><span>${esc(f.title)}</span>${f.status ? `<span class="docs-status">${esc(f.status)}</span>` : ""}</summary>
    <button type="button" class="docs-nav-item docs-nav-overview" data-doc-feature="${esc(f.slug)}"><i class="fa-solid fa-folder-open"></i><span>Visão do dossiê</span></button>
    ${docs.join("")}${others.join("")}${stories ? `<div class="docs-chip-row">${stories}</div>` : ""}</details>`;
}

/** @param {any[]} nodes tree nodes from /docs/tree */
function treeNav(nodes) {
  return nodes.map((n) => (n.kind === "dir"
    ? `<details class="docs-tree-dir"><summary><i class="fa-regular fa-folder"></i> ${esc(n.name)}</summary>${treeNav(n.children || [])}</details>`
    : docItem(n.path, n.name, "", /\.md$/i.test(n.name) ? "fa-regular fa-file-lines" : "fa-solid fa-file-code"))).join("");
}

/**
 * @param {any} catalog /docs/catalog
 * @param {any} tree /docs/tree
 */
export function renderDocsNav(catalog, tree) {
  if (!catalog || catalog.found === false) return '<div class="docs-empty">Este projeto não tem a pasta doc/ no repositório.</div>';
  const review = [...(catalog.revisao || []), ...(catalog.checklist || []), ...(catalog.pendencias || []), ...(catalog.inicio || [])];
  const storyItem = (s) => docItem(s.path, `${s.id}${s.title ? ` · ${s.title.replace(new RegExp(`^${s.id}\\s*`), "")}` : ""}${s.aliasOf ? ` (virou ${s.aliasOf})` : ""}`);
  const features = catalog.funcionalidades || [];
  return `
    <label class="docs-filter"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-docs-filter placeholder="Filtrar documentos" aria-label="Filtrar documentos"></label>
    ${section("Revisão", "fa-solid fa-list-check", review.map((p) => docItem(p, fileName(p))).join(""), review.length, true)}
    ${section("Funcionalidades", "fa-solid fa-cubes", features.map(featureNav).join(""), features.length, true)}
    ${section("Histórias", "fa-solid fa-book-bookmark", (catalog.historias || []).map(storyItem).join(""), (catalog.historias || []).length)}
    ${section("Rascunhos", "fa-regular fa-pen-to-square", (catalog.rascunhos || []).map(storyItem).join(""), (catalog.rascunhos || []).length)}
    ${tree && tree.tree ? section("Todos os arquivos", "fa-solid fa-folder-tree", treeNav(tree.tree), tree.tree.length) : ""}`;
}

/** @param {string} slug @param {any} refs */
export function renderFeatureView(slug, refs) {
  const f = refs?.features?.[slug];
  if (!f) return renderMissing("feature", slug);
  const docs = Object.entries(f.docs || {}).map(([kind, path]) => docItem(path, DOC_KIND_LABELS[kind] || kind));
  const stories = (f.stories || []).map((s) => {
    const st = refs.stories?.[s.id];
    return `<li><button type="button" class="doc-chip" data-doc-ref="story" data-doc-id="${esc(s.id)}">${esc(s.id)}</button> ${esc(roleLabel(s.role))}${st?.title ? ` · ${esc(st.title)}` : ' · <span class="doc-link-missing">sem user-story.md</span>'}</li>`;
  }).join("");
  return `<article class="docs-view">
    <p class="docs-kicker"><i class="fa-solid fa-cubes"></i> Funcionalidade</p>
    <h1>${esc(f.title)}</h1>
    <p class="docs-meta"><code>${esc(slug)}</code>${f.status ? ` · status <b>${esc(f.status)}</b>` : ""}</p>
    <h2>Documentos do dossiê</h2><div class="docs-grid">${docs.join("") || '<span class="docs-empty">Sem documentos.</span>'}</div>
    ${(f.others || []).length ? `<h2>Outras notas</h2><div class="docs-grid">${f.others.map((p) => docItem(p, fileName(p))).join("")}</div>` : ""}
    <h2>Histórias</h2><ul class="docs-list">${stories || "<li>Nenhuma história em _status.md.</li>"}</ul>
  </article>`;
}

/** @param {string} title @param {{ path: string, anchor?: string, label: string }[]} items */
export function renderChooser(title, items) {
  return `<article class="docs-view"><p class="docs-kicker"><i class="fa-solid fa-code-branch"></i> Mais de um lugar</p><h1>${esc(title)}</h1>
    <p>Esta referência aparece em ${items.length} documentos. Escolha um:</p>
    <div class="docs-grid">${items.map((i) => docItem(i.path, i.label, i.anchor || "")).join("")}</div></article>`;
}

const KIND_LABELS = { rn: "Regra", story: "História", trace: "Item do rastreio", feature: "Funcionalidade", doc: "Documento" };

/** @param {string} kind @param {string} id @param {string} [detail] */
export function renderMissing(kind, id, detail = "") {
  return `<article class="docs-view"><p class="docs-kicker docs-warn"><i class="fa-solid fa-triangle-exclamation"></i> Não encontrada</p>
    <h1>${esc(KIND_LABELS[kind] || kind)} ${esc(id)}</h1>
    <p>${esc(detail || "A referência é citada no mapa, mas não existe na documentação do projeto (doc/). Confira o id no mapa-camadas.json ou crie o documento.")}</p></article>`;
}

/** @param {{ screen: string, kind: string, id: string }[]} missing */
export function renderMissingList(missing) {
  return `<article class="docs-view"><p class="docs-kicker docs-warn"><i class="fa-solid fa-triangle-exclamation"></i> Referências sem documento</p>
    <h1>${missing.length} referência(s) desta tela não resolvem</h1>
    <ul class="docs-list">${missing.map((m) => `<li><b>${esc(KIND_LABELS[m.kind] || m.kind)}</b> <code>${esc(m.id)}</code></li>`).join("")}</ul></article>`;
}

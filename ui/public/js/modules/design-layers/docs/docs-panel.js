// @ts-check
// Documentation panel of the Layers map: a side drawer mounted on document.body, so it survives the
// workspace re-renders and the screen stays visible behind it. It only reads; editing stays in the .md files.
import { dls } from "../../design-layers-store.js";
import { getDocsSource, refreshDocsRefs } from "./docs-source.js";
import { renderDocument } from "./docs-render.js";
import { docHref, writeDocLocation, parseDocLocation } from "./docs-location.js";
import { renderDocsNav, renderFeatureView, renderChooser, renderMissing, renderMissingList } from "./docs-panel-views.js";
import { lineAnchor, criterionAnchor } from "./docs-paths.js";
import { renderMermaidInContainer } from "../../../shared/mermaid-renderer.js";

/** @typedef {{ type: "doc", path: string, anchor?: string } | { type: "feature", slug: string } | { type: "choose", title: string, items: any[] } | { type: "missing", kind: string, id: string } | { type: "missing-list", screen: string } | { type: "home" }} DocsView */

/** @type {{ stack: DocsView[], paths: string[], navLoaded: boolean, navHidden: boolean }} */
const state = { stack: [], paths: [], navLoaded: false, navHidden: false };
/** @type {HTMLElement | null} */
let root = null;

/** @param {any[]} nodes @param {string[]} out */
function flatten(nodes, out = []) {
  for (const n of nodes || []) n.kind === "dir" ? flatten(n.children, out) : out.push(n.path);
  return out;
}

/**
 * Where a reference of the map points, from the index. Criteria are written "DIS-443#2".
 * @param {any} refs @param {string} kind @param {string} id
 * @returns {DocsView}
 */
export function refTarget(refs, kind, id) {
  const missing = /** @type {DocsView} */ ({ type: "missing", kind, id });
  if (!refs) return missing;
  if (kind === "rn") {
    const r = refs.rn?.[id];
    return r ? { type: "doc", path: r.path, anchor: r.anchor } : missing;
  }
  if (kind === "story") {
    const [key, criterion] = String(id).split("#");
    const s = refs.stories?.[key] || refs.stories?.[refs.aliases?.[key]];
    if (!s) return { type: "missing", kind, id: key };
    return { type: "doc", path: s.path, anchor: criterion && s.criteria?.[criterion] ? criterionAnchor(criterion) : "" };
  }
  if (kind === "trace") {
    const list = refs.trace?.[id] || [];
    if (list.length === 1) return { type: "doc", path: list[0].path, anchor: lineAnchor(list[0].line) };
    if (list.length > 1) return { type: "choose", title: id, items: list.map((t) => ({ path: t.path, anchor: lineAnchor(t.line), label: `${t.feature} · ${t.title || id}` })) };
    return missing;
  }
  if (kind === "feature") return refs.features?.[id] ? { type: "feature", slug: id } : missing;
  return { type: "doc", path: id, anchor: "" };
}

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.createElement("aside");
  root.className = "docs-panel";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Documentação do projeto");
  root.innerHTML = `
    <header class="docs-panel-head">
      <button type="button" class="docs-btn" data-docs-action="back" title="Voltar"><i class="fa-solid fa-arrow-left"></i></button>
      <button type="button" class="docs-btn" data-docs-action="nav" title="Mostrar ou ocultar o índice"><i class="fa-solid fa-sitemap"></i></button>
      <div class="docs-panel-title"><b data-docs-title>Documentação</b><small data-docs-path></small></div>
      <button type="button" class="docs-btn" data-docs-action="refresh" title="Atualizar (reler os arquivos)"><i class="fa-solid fa-rotate"></i></button>
      <button type="button" class="docs-btn" data-docs-action="close" title="Fechar"><i class="fa-solid fa-xmark"></i></button>
    </header>
    <div class="docs-panel-body"><nav class="docs-panel-nav" data-docs-nav></nav><section class="docs-panel-content" data-docs-content tabindex="-1"></section></div>`;
  root.addEventListener("click", onClick);
  root.addEventListener("input", onFilter);
  document.body.appendChild(root);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root?.classList.contains("open")) closeDocsPanel();
  });
  return root;
}

/** @param {string} sel */
const q = (sel) => /** @type {HTMLElement} */ (ensureRoot().querySelector(sel));

async function loadNav(force = false) {
  const source = getDocsSource();
  if (!source || (state.navLoaded && !force)) return;
  const [catalog, tree, all] = await Promise.all([source.catalog(), source.tree(), source.paths ? source.paths() : null]);
  state.paths = all || flatten(tree?.tree);
  state.navLoaded = true;
  q("[data-docs-nav]").innerHTML = renderDocsNav(catalog, tree);
}

/** @param {string} title @param {string} sub */
function setTitle(title, sub) {
  q("[data-docs-title]").textContent = title;
  q("[data-docs-path]").textContent = sub;
  /** @type {HTMLButtonElement} */ (q('[data-docs-action="back"]')).disabled = state.stack.length < 2;
}

/** @param {HTMLElement} content @param {string} anchor */
function scrollToAnchor(content, anchor) {
  const el = anchor ? content.querySelector(`[id="${CSS.escape(anchor)}"]`) : null;
  content.querySelectorAll(".docs-target").forEach((n) => n.classList.remove("docs-target"));
  if (el) {
    el.classList.add("docs-target");
    el.scrollIntoView({ block: "center" });
  } else content.scrollTop = 0;
}

/** @param {DocsView} view */
async function renderView(view) {
  const content = q("[data-docs-content]");
  const source = getDocsSource();
  if (view.type === "doc") {
    content.innerHTML = '<div class="docs-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando…</div>';
    const [file] = await Promise.all([source ? source.file(view.path) : null, loadNav()]);
    if (!file || "error" in file) {
      const outside = Boolean(file && "notInPackage" in file && file.notInPackage);
      const why = outside ? "Este documento existe no projeto, mas não foi incluído no pacote de revisão."
        : file?.status === 404 ? "O arquivo não existe na pasta doc/." : file?.status === 403 ? "Este arquivo não é servido pelo leitor (tipo não permitido ou contém segredo)." : `Não foi possível abrir: ${file?.error || "sem fonte de dados"}.`;
      content.innerHTML = renderMissing("doc", view.path, why, outside ? "Não incluído no pacote" : undefined);
      setTitle(outside ? "Fora do pacote de revisão" : "Documento indisponível", view.path);
    } else {
      const { html, title } = renderDocument(file.text, { path: view.path, paths: state.paths, hrefFor: docHref, isAvailable: source?.isIncluded });
      content.innerHTML = `<article class="docs-view docs-md">${html}</article>`;
      setTitle(title, view.path);
      scrollToAnchor(content, view.anchor || "");
      // Diagrams change the height of the page: once they are drawn, the anchor is brought back into view.
      if (content.querySelector(".mermaid")) {
        void renderMermaidInContainer(content).then((n) => { if (n && view.anchor) scrollToAnchor(content, view.anchor); });
      }
    }
    writeDocLocation(view.path, view.anchor || "");
    return;
  }
  writeDocLocation(null);
  if (view.type === "feature") {
    content.innerHTML = renderFeatureView(view.slug, dls.docsRefs);
    setTitle(dls.docsRefs?.features?.[view.slug]?.title || view.slug, `sistema/features/${view.slug}/`);
  } else if (view.type === "choose") {
    content.innerHTML = renderChooser(view.title, view.items);
    setTitle(view.title, "mais de um lugar");
  } else if (view.type === "missing") {
    content.innerHTML = renderMissing(view.kind, view.id);
    setTitle("Referência não encontrada", view.id);
  } else if (view.type === "missing-list") {
    content.innerHTML = renderMissingList((dls.docsRefs?.missing || []).filter((m) => m.screen === view.screen));
    setTitle("Referências sem documento", "");
  } else {
    content.innerHTML = '<div class="docs-empty"><i class="fa-solid fa-book-open"></i> Escolha um documento no índice ao lado.</div>';
    setTitle("Documentação", "");
  }
  content.scrollTop = 0;
}

/** Opens the drawer on a view (or on the index). @param {DocsView} [view] */
export async function openDocsPanel(view) {
  const el = ensureRoot();
  el.classList.add("open");
  el.classList.toggle("nav-hidden", state.navHidden);
  const next = view || state.stack[state.stack.length - 1] || { type: "home" };
  const top = state.stack[state.stack.length - 1];
  if (!top || JSON.stringify(top) !== JSON.stringify(next)) state.stack.push(next);
  void loadNav();
  await renderView(next);
}

export function closeDocsPanel() {
  root?.classList.remove("open");
  writeDocLocation(null);
}

/** @param {string} kind @param {string} id */
export function openDocRef(kind, id) {
  return openDocsPanel(refTarget(dls.docsRefs, kind, id));
}

/** Opens the document named in the address (?doc= in the Harness, #doc/ in the package). */
export function openDocFromLocation() {
  if (typeof location === "undefined") return false;
  const hit = parseDocLocation(location);
  if (!hit) return false;
  void openDocsPanel({ type: "doc", path: hit.path, anchor: hit.anchor });
  return true;
}

/** @param {MouseEvent} e */
function onClick(e) {
  const t = /** @type {HTMLElement} */ (e.target).closest("[data-doc-path],[data-doc-ref],[data-doc-feature],[data-docs-action]");
  if (!t) return;
  const el = /** @type {HTMLElement} */ (t);
  if (el.dataset.docPath !== undefined) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const top = state.stack[state.stack.length - 1];
    if (top?.type === "doc" && top.path === el.dataset.docPath && el.dataset.docAnchor) {
      scrollToAnchor(q("[data-docs-content]"), el.dataset.docAnchor);
      return;
    }
    void openDocsPanel({ type: "doc", path: el.dataset.docPath || "", anchor: el.dataset.docAnchor || "" });
  } else if (el.dataset.docRef) void openDocRef(el.dataset.docRef, el.dataset.docId || "");
  else if (el.dataset.docFeature) void openDocsPanel({ type: "feature", slug: el.dataset.docFeature });
  else if (el.dataset.docsAction === "close") closeDocsPanel();
  else if (el.dataset.docsAction === "nav") ensureRoot().classList.toggle("nav-hidden", (state.navHidden = !state.navHidden));
  else if (el.dataset.docsAction === "back" && state.stack.length > 1) {
    state.stack.pop();
    void renderView(state.stack[state.stack.length - 1]);
  } else if (el.dataset.docsAction === "refresh") void refresh();
}

async function refresh() {
  getDocsSource()?.reset?.();
  await refreshDocsRefs();
  await loadNav(true);
  const top = state.stack[state.stack.length - 1];
  if (top) await renderView(top);
}

/** @param {Event} e */
function onFilter(e) {
  const input = /** @type {HTMLInputElement} */ (e.target);
  if (!input.matches("[data-docs-filter]")) return;
  const term = input.value.trim().toLowerCase();
  const nav = q("[data-docs-nav]");
  nav.querySelectorAll("[data-filter]").forEach((n) => {
    /** @type {HTMLElement} */ (n).hidden = Boolean(term) && !String(/** @type {HTMLElement} */ (n).dataset.filter).includes(term);
  });
  if (term) nav.querySelectorAll("details").forEach((d) => { /** @type {HTMLDetailsElement} */ (d).open = true; });
}

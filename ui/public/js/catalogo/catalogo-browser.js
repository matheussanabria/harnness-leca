// @ts-check
// Repository-style browser for one skill or agent: file tree on the left, viewer on the right.
import { md } from "../shared/markdown.js";
import { renderMermaidInContainer } from "../shared/mermaid-renderer.js";
import { esc, linkTag } from "./catalogo-view.js";
import { renderEditor } from "./catalogo-editor.js";
import { renderTree, pickDefaultFile, splitFrontmatter, isMarkdown } from "./catalogo-tree.js";

const $ = (id) => document.getElementById(id);
const state = { canEdit: false, item: null, tree: [], file: "", raw: false, cache: null };

function query(extra) {
  const q = new URLSearchParams({ kind: state.item.kind, source: state.item.source, ref: state.item.ref, ...extra });
  return q.toString();
}

function renderWorkflowOverview(item) {
  if (item.kind !== "workflow" || !item.stages || !item.stages.length) return "";
  const stagesHtml = item.stages.map((st) => {
    const agentsHtml = (st.agents && st.agents.length)
      ? st.agents.map((ag) => `<button type="button" class="k-ref-chip k-ref-agent" data-nav-kind="agent" data-nav-name="${esc(ag.id)}" title="Ver agente ${esc(ag.label || ag.id)}"><i class="fa-solid fa-user-gear" aria-hidden="true"></i> ${esc(ag.label || ag.id)}</button>`).join(" ")
      : `<span class="k-tag"><i class="fa-solid fa-terminal" aria-hidden="true"></i> Sessao</span>`;
    const skillsHtml = (st.skills && st.skills.length)
      ? st.skills.map((sk) => `<button type="button" class="k-ref-chip k-ref-skill" data-nav-kind="skill" data-nav-name="${esc(sk)}" title="Ver skill ${esc(sk)}"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> ${esc(sk)}</button>`).join(" ")
      : `<span class="k-muted-text">Sem skills exigidas</span>`;
    const approvalBadge = st.requiresApproval ? `<span class="k-tag k-warn"><i class="fa-solid fa-user-check" aria-hidden="true"></i> Aprovacao</span>` : "";
    return `<div class="k-wf-stage-row">
      <div class="k-wf-stage-head"><span class="k-tag">#${st.order}</span> <strong>${esc(st.label || st.id)}</strong> ${approvalBadge}</div>
      <div class="k-wf-stage-meta"><span class="k-links-label">Agente(s):</span> ${agentsHtml}</div>
      <div class="k-wf-stage-meta"><span class="k-links-label">Skills:</span> ${skillsHtml}</div>
      ${st.gate ? `<div class="k-wf-stage-gate"><i class="fa-solid fa-door-closed" aria-hidden="true"></i> ${esc(st.gate)}</div>` : ""}
    </div>`;
  }).join("");

  return `<details class="k-wf-stages-accordion" open>
    <summary><i class="fa-solid fa-diagram-project" aria-hidden="true"></i> Etapas do Workflow (${item.stages.length})</summary>
    <div class="k-wf-stages-list">${stagesHtml}</div>
  </details>`;
}

/** Scrum lanes that reference a skill, one chip per project and lane. */
function renderLinks(item) {
  if (item.kind === "workflow") return renderWorkflowOverview(item);
  if (item.kind !== "skill") return "";
  if (item.orphan) return linkTag(item);
  if (!item.lanes || !item.lanes.length) return "";
  const chips = item.lanes.map((l) => `<span class="k-tag"><i class="fa-solid fa-link" aria-hidden="true"></i> ${esc(l.project)} / ${esc(l.laneName)}</span>`).join("");
  return `<span class="k-links-label">Raias do Scrum:</span> ${chips}`;
}

function paintViewer() {
  const f = state.cache;
  const box = $("kViewer");
  if (!f) {
    box.innerHTML = `<p class="c-empty">Selecione um arquivo.</p>`;
    return;
  }
  const head = `<div class="k-vhead"><b>${esc(f.name)}</b><span class="k-tag">${f.size} B</span>` +
    (state.canEdit && f.revision && !f.truncated ? `<button type="button" class="btn-row" id="kEdit"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button>` : "") +
    (isMarkdown(f.name) ? `<button type="button" class="btn-row" id="kRawToggle">${state.raw ? "Renderizado" : "Código"}</button>` : "") + `</div>`;
  if (f.error) return void (box.innerHTML = head + `<p class="c-empty">${esc(f.error)}</p>`);
  if (f.binary) return void (box.innerHTML = head + `<p class="c-empty">Arquivo binário ou sem prévia de texto.</p>`);
  const note = f.truncated ? `<p class="c-empty">Mostrando só o início do arquivo.</p>` : "";
  if (isMarkdown(f.name) && !state.raw) {
    const { meta, body } = splitFrontmatter(f.content);
    const metaHtml = meta ? `<details class="k-meta-block"><summary>Frontmatter</summary><pre>${esc(meta)}</pre></details>` : "";
    box.innerHTML = head + note + metaHtml + `<div class="k-md">${md(body)}</div>`;
    renderMermaidInContainer(box).catch(() => {});
  } else {
    box.innerHTML = head + note + `<pre class="k-code">${esc(f.content)}</pre>`;
  }
}

async function openFile(rel, fromUser = false) {
  state.file = rel;
  $("kTree").innerHTML = renderTree(state.tree, rel);
  try {
    const res = await fetch(`/api/catalog/file?${query({ path: rel })}`);
    state.cache = await res.json();
    if (!res.ok) state.cache = { name: rel, size: 0, error: state.cache.error || `HTTP ${res.status}` };
  } catch (err) {
    state.cache = { name: rel, size: 0, error: err.message };
  }
  paintViewer();
  // On a narrow screen the viewer sits below the tree: bring it into view after a tap.
  if (fromUser && window.matchMedia("(max-width: 760px)").matches) $("kViewer").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Opens the browser for an item and shows its main file. */
export async function openBrowser(item, canEdit = false) {
  state.item = item;
  state.canEdit = canEdit;
  state.raw = false;
  $("kBrowser").hidden = false;
  $("kCatalog").hidden = true;
  $("kCrumb").textContent = `${item.kind === "agent" ? "Agente" : item.kind === "workflow" ? "Workflow" : "Skill"} / ${item.label || item.name}`;
  $("kBrDesc").textContent = item.description || "";
  $("kBrLinks").innerHTML = renderLinks(item);
  $("kTree").innerHTML = `<p class="c-empty">Carregando...</p>`;
  $("kViewer").innerHTML = "";
  try {
    const res = await fetch(`/api/catalog/tree?${query({})}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    state.tree = data.tree;
    $("kTreeNote").textContent = data.truncated ? "Lista parcial: muitos arquivos." : "";
    await openFile(pickDefaultFile(state.tree));
  } catch (err) {
    $("kTree").innerHTML = `<p class="c-empty">${esc(err.message)}</p>`;
  }
}

export function getCurrentItem() {
  return state.item;
}

export function closeBrowser() {
  $("kBrowser").hidden = true;
  $("kCatalog").hidden = false;
  state.item = null;
}

export function wireBrowser(onBack) {
  $("kBack").addEventListener("click", () => {
    if (typeof onBack === "function") {
      onBack();
    } else {
      closeBrowser();
    }
  });
  $("kTree").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-file]");
    if (btn) openFile(btn.getAttribute("data-file"), true);
  });
  $("kViewer").addEventListener("click", (e) => {
    if (e.target.closest("#kEdit")) {
      const target = { kind: state.item.kind, source: state.item.source, ref: state.item.ref, path: state.file };
      return renderEditor($("kViewer"), state.cache, {
        target, onCancel: paintViewer,
        onSaved: (r) => { state.cache = { ...state.cache, ...r }; paintViewer(); },
      });
    }
    if (!e.target.closest("#kRawToggle")) return;
    state.raw = !state.raw;
    paintViewer();
  });
}

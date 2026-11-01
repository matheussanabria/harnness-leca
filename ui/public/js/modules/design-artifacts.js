// @ts-check
import { $, esc } from "../shared/dom.js";
import { bindPagers, pagedHtml, setPage } from "../shared/pagination.js";
import { setupArtifactImport } from "./design-artifacts-import.js";
import { setupArtifactAccess } from "./design-artifacts-access.js";
import { setupArtifactPreview } from "./design-artifacts-preview.js";
import { setupArtifactRelationships } from "./design-artifacts-relationships.js";
import { logArtifactsAction, readArtifactsState, saveArtifactsState } from "./design-artifacts-state.js";

const KIND_META = {
  prototype: { label: "Protótipo", icon: "fa-file-code" },
  atelier: { label: "Ateliê", icon: "fa-wand-magic-sparkles" },
  chat: { label: "Conversa", icon: "fa-comments" },
  extraction: { label: "Extração", icon: "fa-filter" },
  document: { label: "Documento", icon: "fa-file-lines" },
  response: { label: "Resposta", icon: "fa-reply" },
  imported: { label: "Importado", icon: "fa-file-import" },
};

const AVAILABILITY = {
  local: { label: "Local", icon: "fa-hard-drive", className: "is-local" },
  external: { label: "Externo", icon: "fa-arrow-up-right-from-square", className: "is-external" },
  missing: { label: "Ausente", icon: "fa-triangle-exclamation", className: "is-missing" },
  invalid: { label: "Inválido", icon: "fa-ban", className: "is-invalid" },
};

const ACCESS = {
  project: { label: "Projeto", icon: "fa-users", className: "is-project" },
  local: { label: "Somente local", icon: "fa-lock", className: "is-local-only" },
};

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function metadataLine(item) {
  if (item.kind !== "imported") return "";
  const meta = item.metadata;
  if (!meta) return `<span class="artifact-meta">Origem não registrada</span>`;
  const source = meta.source === "folder" ? "pasta" : "arquivo";
  const hash = meta.sha256 ? ` · sha256 ${meta.sha256.slice(0, 12)}` : "";
  return `<span class="artifact-meta">Importado via ${esc(source)} em ${esc(formatDate(meta.importedAt))}${esc(hash)}</span>`;
}
function renderAccess(item, canManage) {
  const access = ACCESS[item.access] || ACCESS.project;
  const canChange = canManage && item.kind === "imported" && Boolean(item.file);
  const next = item.access === "local" ? "project" : "local";
  const action = next === "local" ? "Restringir ao computador local" : "Liberar para o projeto";
  const icon = next === "local" ? "fa-lock" : "fa-lock-open";
  const button = canChange
    ? `<button type="button" class="artifact-access-toggle" data-artifact-file="${esc(item.file)}" data-artifact-access="${next}" title="${action}" aria-label="${action}"><i class="fa-solid ${icon}"></i></button>`
    : "";
  return `<span class="artifact-access"><span class="artifact-access-badge ${access.className}"><i class="fa-solid ${access.icon}"></i> ${access.label}</span>${button}</span>`;
}

function renderRow(item, canManage, selectedKey = "") {
  const kind = KIND_META[item.kind] || { label: item.kind, icon: "fa-box-archive" };
  const availability = AVAILABILITY[item.availability] || AVAILABILITY.invalid;
  const canPreview = item.availability === "local" && Boolean(item.file);
  const preview = canPreview
    ? `<button type="button" class="artifact-preview-button" data-artifact-preview data-artifact-kind="${esc(item.kind)}" data-artifact-file="${esc(item.file)}" data-artifact-title="${esc(item.title || item.id)}" aria-label="Visualizar ${esc(item.title || item.id)}"><i class="fa-solid fa-eye"></i></button>`
    : "";
  const relate = canPreview
    ? `<button type="button" class="artifact-relations-button" data-artifact-relate data-artifact-key="${esc(item.key)}" data-artifact-title="${esc(item.title || item.id)}" aria-label="Vínculos de ${esc(item.title || item.id)}"><i class="fa-solid fa-diagram-project"></i></button>`
    : "";
  const detail = item.kind === "atelier"
    ? `${item.screenCount || 1} tela(s) · v${item.version || 1}`
    : item.externalUrl || item.file || "sem arquivo";
  return `<tr data-artifact-key="${esc(item.key)}" class="${item.key === selectedKey ? "is-selected" : ""}" aria-selected="${item.key === selectedKey}">
    <td>
      <span class="artifact-name"><i class="fa-solid ${kind.icon}"></i> ${esc(item.title || item.id)}${preview}${relate}</span>
      <span class="artifact-path" title="${esc(detail)}">${esc(detail)}</span>
      ${metadataLine(item)}
    </td>
    <td><span class="artifact-kind-badge">${esc(kind.label)}</span></td>
    <td>${esc(item.origin || "—")}</td>
    <td>${renderAccess(item, canManage)}</td>
    <td>${formatBytes(item.size)}</td>
    <td>${esc(formatDate(item.modifiedAt))}</td>
    <td><span class="artifact-status ${availability.className}"><i class="fa-solid ${availability.icon}"></i> ${availability.label}</span></td>
  </tr>`;
}

export async function renderArtifactsWorkspace(container, slug, data, onChanged) {
  if (!data?.ok) {
    container.innerHTML = `<div class="artifact-empty">
      <i class="fa-solid fa-box-archive"></i>
      <strong>Inventário indisponível</strong>
      <p>Não foi possível carregar os artefatos do projeto <code>${esc(slug)}</code>.</p>
    </div>`;
    return;
  }

  const summary = data.summary || { total: 0, byKind: {} };
  const canManage = data.canManageAccess === true;
  const filters = ["all", ...Object.keys(KIND_META).filter((kind) => summary.byKind?.[kind])];
  const saved = await readArtifactsState();
  let currentFilter = filters.includes(saved.kindFilter) ? saved.kindFilter : "all";
  let query = saved.query;
  let selectedKey = saved.selectedKey;

  container.innerHTML = `<section class="artifact-inventory" aria-label="Inventário de artefatos do projeto">
    <header class="artifact-header">
      <div>
        <h3><i class="fa-solid fa-box-archive"></i> Inventário de artefatos</h3>
        <p>${summary.total} artefato(s) em <code>${esc(slug)}</code>. Nenhum conteúdo de arquivo é exposto.</p>
      </div>
      <div class="artifact-header-actions">
        <button type="button" class="artifact-import-button" id="artifactImportFiles">
          <i class="fa-solid fa-file-arrow-up"></i> Importar arquivos
        </button>
        <button type="button" class="artifact-import-button" id="artifactImportFolder">
          <i class="fa-solid fa-folder-plus"></i> Importar pasta
        </button>
        <span class="artifact-total" id="artifactTotal">${summary.total}</span>
        <input id="artifactFileInput" type="file" multiple hidden>
        <input id="artifactFolderInput" type="file" webkitdirectory directory multiple hidden>
      </div>
    </header>
    ${data.warnings?.length ? `<div class="artifact-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${data.warnings.map(esc).join(" ")}</div>` : ""}
    ${data.truncated ? `<div class="artifact-warning"><i class="fa-solid fa-scissors"></i> Lista limitada; refine a busca para ver os demais.</div>` : ""}
    <p class="artifact-import-status" id="artifactImportStatus" role="status" aria-live="polite"></p>
    <div class="artifact-toolbar">
      <label class="artifact-search" for="artifactSearch">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="artifactSearch" type="search" placeholder="Buscar por título, caminho ou origem" autocomplete="off">
      </label>
      <div class="artifact-filters" role="group" aria-label="Filtrar por tipo">
        ${filters.map((kind) => {
          const meta = KIND_META[kind] || { label: "Todos", icon: "fa-layer-group" };
          const count = kind === "all" ? summary.total : summary.byKind[kind];
          return `<button type="button" class="artifact-filter ${kind === currentFilter ? "active" : ""}" data-filter="${kind}" aria-pressed="${kind === currentFilter}">
            <i class="fa-solid ${meta.icon}"></i> ${meta.label} <span>${count}</span>
          </button>`;
        }).join("")}
      </div>
    </div>
    <div class="artifact-table-wrap">
      <table class="artifact-table">
        <caption class="artifact-caption">Artefatos derivados de design, conversas e contexto do projeto</caption>
        <thead><tr><th scope="col">Artefato</th><th scope="col">Tipo</th><th scope="col">Origem</th><th scope="col">Acesso</th><th scope="col">Tamanho</th><th scope="col">Atualizado</th><th scope="col">Estado</th></tr></thead>
        <tbody id="artifactRows"></tbody>
      </table>
      <div id="artifactEmpty" class="artifact-empty" hidden>
        <i class="fa-solid fa-magnifying-glass"></i>
        <strong>Nenhum artefato encontrado</strong>
        <p>Ajuste a busca ou selecione outro tipo.</p>
      </div>
    </div>
    <div id="artifactPager"></div>
    <section id="artifactPreview" class="artifact-preview" aria-label="Prévia do artefato" aria-live="polite" hidden></section>
    <section id="artifactRelations" class="artifact-relations" aria-label="Vínculos do artefato" aria-live="polite" hidden></section>
  </section>`;

  const rows = /** @type {HTMLElement} */ ($("artifactRows"));
  const empty = /** @type {HTMLElement} */ ($("artifactEmpty"));
  const total = /** @type {HTMLElement} */ ($("artifactTotal"));
  const pagerEl = /** @type {HTMLElement} */ ($("artifactPager"));
  const search = /** @type {HTMLInputElement} */ ($("artifactSearch"));

  const paint = () => {
    const needle = query.trim().toLowerCase();
    const visible = (data.items || []).filter((item) => {
      if (currentFilter !== "all" && item.kind !== currentFilter) return false;
      if (!needle) return true;
      return [
        item.title, item.file, item.origin, item.kind,
        item.metadata?.originalName, item.metadata?.source,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
    const paged = pagedHtml(visible, "artifacts", (item) => renderRow(item, canManage, selectedKey), { pageSize: 25, label: "Paginação dos artefatos" });
    rows.innerHTML = paged.html;
    pagerEl.innerHTML = paged.pager;
    bindPagers(pagerEl, () => paint());
    empty.hidden = visible.length > 0;
    total.textContent = String(visible.length);
  };

  const persist = () => {
    void saveArtifactsState({ kindFilter: currentFilter, query, selectedKey });
  };

  search.value = query;
  container.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const element = /** @type {HTMLElement} */ (button);
      currentFilter = element.dataset.filter || "all";
      container.querySelectorAll("[data-filter]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      persist();
      setPage("artifacts", 1);
      void logArtifactsAction("filtrar-artefatos", currentFilter);
      paint();
    });
  });
  search.addEventListener("input", () => {
    query = search.value;
    persist();
    setPage("artifacts", 1);
    paint();
  });
  search.addEventListener("change", () => {
    void logArtifactsAction("buscar-artefatos", query.slice(0, 120));
  });
  rows.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const row = /** @type {HTMLElement | null} */ (target.closest("tr[data-artifact-key]"));
    if (!row) return;
    selectedKey = row.dataset.artifactKey || "";
    persist();
    void logArtifactsAction("selecionar-artefato", selectedKey);
    paint();
  });
  paint();
  setupArtifactImport(container, slug, onChanged);
  setupArtifactAccess(container, slug, onChanged);
  setupArtifactPreview(container, slug);
  setupArtifactRelationships(container, slug);
}

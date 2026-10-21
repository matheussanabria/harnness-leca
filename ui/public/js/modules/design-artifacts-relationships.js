// @ts-check
import { esc, showToast } from "../shared/dom.js";

const state = { slug: "", artifactKey: "", title: "", data: null, busy: false };

function apiUrl(slug) {
  return `/api/project/${encodeURIComponent(slug)}/artifacts/relationships`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Falha ao carregar os vínculos.");
  return body;
}

function targetLabel(target) {
  return `${target.screenTitle} · ${target.fieldLabel}`;
}

function linkItem(link) {
  return `<li class="artifact-relation-item">
    <span><i class="fa-solid fa-link"></i> ${esc(targetLabel(link))}</span>
    <span class="artifact-relation-actions">
      <button type="button" data-rel-open="${esc(link.key)}" title="Abrir no Mapa em Camadas" aria-label="Abrir ${esc(targetLabel(link))} no Mapa em Camadas"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
      <button type="button" data-rel-remove="${esc(link.key)}" title="Remover vínculo" aria-label="Remover vínculo com ${esc(targetLabel(link))}"><i class="fa-solid fa-link-slash"></i></button>
    </span>
  </li>`;
}

function unresolvedItem(item) {
  return `<li class="artifact-relation-item is-unresolved">
    <span><i class="fa-solid fa-triangle-exclamation"></i> Destino não encontrado</span>
    <button type="button" data-rel-remove="${esc(item.targetKey)}" title="Remover vínculo órfão" aria-label="Remover vínculo órfão"><i class="fa-solid fa-link-slash"></i></button>
  </li>`;
}

function renderTargetOptions(targets) {
  const groups = new Map();
  for (const target of targets) {
    if (!groups.has(target.screenTitle)) groups.set(target.screenTitle, []);
    groups.get(target.screenTitle).push(target);
  }
  return [...groups.entries()].map(([screen, items]) => `<optgroup label="${esc(screen)}">
    ${items.map((target) => `<option value="${esc(target.key)}">${esc(target.fieldLabel)}</option>`).join("")}
  </optgroup>`).join("");
}

function renderPanel(panel) {
  const key = state.artifactKey;
  const data = state.data || {};
  const links = data.items?.[key] || [];
  const unresolved = (data.unresolved || []).filter((item) => item.artifactKey === key);
  const canManage = data.canManage === true;
  const hasLinks = links.length > 0 || unresolved.length > 0;

  panel.innerHTML = `<header class="artifact-relations-head">
    <div>
      <h3><i class="fa-solid fa-diagram-project"></i> Vínculos do artefato</h3>
      <p title="${esc(key)}">${esc(state.title || key)}</p>
    </div>
    <button type="button" class="artifact-relations-close" data-artifact-relations-close aria-label="Fechar vínculos"><i class="fa-solid fa-xmark"></i></button>
  </header>
  <p class="artifact-relations-status" role="status" aria-live="polite">${state.busy ? "Atualizando vínculos..." : ""}</p>
  ${data.warnings?.length ? `<div class="artifact-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${data.warnings.map(esc).join(" ")}</div>` : ""}
  <div class="artifact-relations-body">
    <h4>Relacionado a</h4>
    ${hasLinks ? `<ul class="artifact-relation-list">${links.map(linkItem).join("")}${unresolved.map(unresolvedItem).join("")}</ul>` : `<p class="artifact-relations-empty"><i class="fa-solid fa-link-slash"></i> Nenhuma tela ou campo relacionado.</p>`}
  </div>
  ${canManage ? `<div class="artifact-relations-add">
    <label for="artifactRelTarget">Relacionar com tela / campo</label>
    <div>
      <select id="artifactRelTarget" ${data.targets?.length ? "" : "disabled"}>
        ${renderTargetOptions(data.targets || []) || `<option value="">Nenhuma tela disponível</option>`}
      </select>
      <button type="button" class="artifact-relations-add-button" data-rel-add ${data.targets?.length ? "" : "disabled"}>
        <i class="fa-solid fa-plus"></i> Adicionar
      </button>
    </div>
  </div>` : `<p class="artifact-relations-empty"><i class="fa-solid fa-lock"></i> Alterações de vínculo apenas no computador local.</p>`}`;
}

function openMapTarget(link) {
  window.dispatchEvent(new CustomEvent("harness:open-layer-target", {
    detail: { route: link.route, screenId: link.screenId, fieldId: link.fieldId },
  }));
}

function closePanel(panel) {
  panel.hidden = true;
  panel.innerHTML = "";
  state.artifactKey = "";
  state.title = "";
  state.data = null;
  state.busy = false;
}

async function refreshPanel(panel, artifactKey, targetKey, action) {
  state.busy = true;
  renderPanel(panel);
  try {
    state.data = await requestJson(apiUrl(state.slug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifactKey, targetKey, action }),
    });
    showToast(action === "add" ? "Vínculo adicionado." : "Vínculo removido.");
  } catch (err) {
    showToast(err.message || "Falha ao atualizar os vínculos.");
  } finally {
    state.busy = false;
    renderPanel(panel);
  }
}

function findLink(artifactKey, targetKey) {
  return (state.data?.items?.[artifactKey] || []).find((link) => link.key === targetKey) || null;
}

export function setupArtifactRelationships(container, slug) {
  container.dataset.artifactRelationshipsSlug = slug;
  if (container.dataset.artifactRelationshipsBound === "1") return;
  container.dataset.artifactRelationshipsBound = "1";

  container.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = container.querySelector("#artifactRelations");
    if (!(panel instanceof HTMLElement)) return;

    if (target.closest("[data-artifact-relations-close]")) {
      closePanel(panel);
      return;
    }

    const openButton = target.closest("[data-artifact-relate]");
    if (openButton instanceof HTMLButtonElement) {
      state.slug = container.dataset.artifactRelationshipsSlug || slug;
      state.artifactKey = openButton.dataset.artifactKey || "";
      state.title = openButton.dataset.artifactTitle || state.artifactKey;
      state.data = null;
      panel.hidden = false;
      panel.innerHTML = `<div class="artifact-preview-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando vínculos...</div>`;
      try {
        state.data = await requestJson(apiUrl(state.slug));
        renderPanel(panel);
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err) {
        panel.innerHTML = `<div class="artifact-preview-unsupported"><i class="fa-solid fa-triangle-exclamation"></i><strong>Vínculos indisponíveis</strong><p>${esc(err.message)}</p></div>`;
        showToast(err.message || "Falha ao abrir os vínculos.");
      }
      return;
    }

    if (state.busy || !state.artifactKey) return;

    const removeButton = target.closest("[data-rel-remove]");
    if (removeButton instanceof HTMLButtonElement) {
      await refreshPanel(panel, state.artifactKey, removeButton.dataset.relRemove || "", "remove");
      return;
    }

    if (target.closest("[data-rel-add]")) {
      const select = panel.querySelector("#artifactRelTarget");
      if (!(select instanceof HTMLSelectElement) || !select.value) return;
      await refreshPanel(panel, state.artifactKey, select.value, "add");
      return;
    }

    const openLink = target.closest("[data-rel-open]");
    if (openLink instanceof HTMLButtonElement) {
      const link = findLink(state.artifactKey, openLink.dataset.relOpen || "");
      if (!link) return;
      openMapTarget(link);
      closePanel(panel);
    }
  });
}

// @ts-check
import { esc, showToast } from "../shared/dom.js";

const LABEL = {
  text: { label: "Texto", icon: "fa-file-lines" },
  html: { label: "HTML isolado", icon: "fa-code" },
  image: { label: "Imagem", icon: "fa-image" },
  pdf: { label: "PDF", icon: "fa-file-pdf" },
  unsupported: { label: "Sem prévia", icon: "fa-circle-info" },
};

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchPreview(slug, kind, file) {
  const params = new URLSearchParams({ kind, file });
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/artifacts/preview?${params.toString()}`);
  if (!res.ok) {
    let message = "Não foi possível abrir a prévia.";
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

function previewBody(payload, title) {
  if (payload.previewKind === "text") {
    const truncated = payload.truncated
      ? `<p class="artifact-preview-note"><i class="fa-solid fa-scissors"></i> Conteúdo truncado em 512 KB.</p>`
      : "";
    return `<pre class="artifact-preview-text" data-language="${esc(payload.language)}"><code>${esc(payload.content)}</code></pre>${truncated}`;
  }
  if (payload.previewKind === "html") {
    return `<iframe class="artifact-preview-frame" src="${esc(payload.url)}" sandbox="" referrerpolicy="no-referrer" title="Prévia de ${esc(title)}"></iframe>
      <p class="artifact-preview-note"><i class="fa-solid fa-shield-halved"></i> HTML isolado; scripts e acesso à origem do harness estão desativados.</p>`;
  }
  if (payload.previewKind === "image") {
    return `<div class="artifact-preview-image"><img src="${esc(payload.url)}" alt="Prévia de ${esc(title)}" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }
  if (payload.previewKind === "pdf") {
    return `<div class="artifact-preview-pdf">
      <i class="fa-solid fa-file-pdf"></i>
      <a href="${esc(payload.url)}" target="_blank" rel="noopener noreferrer">Abrir PDF em nova aba</a>
      <span>O PDF é servido isolado e sem scripts.</span>
    </div>`;
  }
  return `<div class="artifact-preview-unsupported">
    <i class="fa-solid fa-circle-info"></i>
    <strong>Sem prévia segura</strong>
    <p>${esc(payload.reason || "Este tipo de arquivo não pode ser exibido.")}</p>
  </div>`;
}

function renderPanel(panel, payload, title) {
  const meta = payload.metadata;
  const source = meta
    ? `${meta.origin === "existing" ? "Origem não registrada" : "Importado"} · ${meta.source === "folder" ? "pasta" : "arquivo"}`
    : "Artefato derivado do projeto";
  const access = payload.access === "local" ? "Somente local" : "Projeto";
  const label = LABEL[payload.previewKind] || LABEL.unsupported;
  panel.innerHTML = `<header class="artifact-preview-header">
      <div>
        <h4><i class="fa-solid ${label.icon}"></i> ${esc(title)}</h4>
        <p><code>${esc(payload.file)}</code> · ${esc(formatBytes(payload.size))} · ${esc(access)} · ${esc(source)}</p>
      </div>
      <button type="button" class="artifact-preview-close" data-artifact-preview-close aria-label="Fechar prévia">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </header>
    <div class="artifact-preview-body">${previewBody(payload, title)}</div>`;
  panel.querySelector("[data-artifact-preview-close]")?.focus();
}

export function setupArtifactPreview(container, slug) {
  container.dataset.artifactPreviewSlug = slug;
  if (container.dataset.artifactPreviewBound === "1") return;
  container.dataset.artifactPreviewBound = "1";

  container.addEventListener("click", async (event) => {
    const panel = container.querySelector("#artifactPreview");
    if (!(panel instanceof HTMLElement)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-artifact-preview-close]")) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    const button = target.closest("[data-artifact-preview]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const kind = button.dataset.artifactKind || "";
    const file = button.dataset.artifactFile || "";
    const title = button.dataset.artifactTitle || file;
    if (!kind || !file) return;

    panel.hidden = false;
    panel.innerHTML = `<div class="artifact-preview-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando prévia...</div>`;
    try {
      const currentSlug = container.dataset.artifactPreviewSlug || slug;
      renderPanel(panel, await fetchPreview(currentSlug, kind, file), title);
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      panel.innerHTML = `<div class="artifact-preview-unsupported"><i class="fa-solid fa-triangle-exclamation"></i><strong>Prévia indisponível</strong><p>${esc(err.message)}</p></div>`;
      showToast(err.message || "Falha ao abrir a prévia.");
    }
  });
}

// @ts-check
/**
 * Mapeamento de elementos visuais para arquivos e componentes (EP-06.05).
 * Responsabilidade única: consultar a rastreabilidade, normalizar a resposta,
 * renderizar o painel do Ateliê e injetar o contexto no chat do Studio.
 */
import { $, esc, showToast } from "../shared/dom.js";
import { insertStudioContext } from "./studio-chat.js";

export const FALLBACK_COMPONENT_ID = "html.element";

/**
 * @param {{ slug: string, protoId: string, screenId?: string, nodeId: string }} input
 * @returns {string}
 */
export function buildTraceabilityUrl({ slug, protoId, screenId = "", nodeId }) {
  const params = new URLSearchParams({ nodeId });
  if (screenId) params.set("screenId", screenId);
  return `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/traceability?${params.toString()}`;
}

/**
 * @param {{ slug: string, protoId: string, screenId?: string, nodeId: string }} input
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<any>}
 */
export async function fetchElementTraceability(input, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(buildTraceabilityUrl(input));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha HTTP ${response.status}`);
  return data.traceability;
}

/**
 * @param {any} trace
 * @returns {{ nodeId: string, screenId: string, componentId: string, isRegistered: boolean, screenFile: string, styleFile: string, manifestFile: string | null, registryFile: string, componentFiles: Array<{ framework: string, path: string, entry: boolean }>, frameworks: string[], code: { vanilla?: string, angular18?: string, react18?: string } }}
 */
export function normalizeElementMapping(trace = {}) {
  const files = trace.files || {};
  const components = Array.isArray(files.components) ? files.components : [];
  const componentFiles = components
    .filter((entry) => entry && entry.path)
    .map((entry) => ({
      framework: entry.framework || "desconhecido",
      path: entry.path,
      entry: Boolean(entry.entry)
    }));

  return {
    nodeId: trace.nodeId || "",
    screenId: trace.screenId || "",
    componentId: trace.component?.id || FALLBACK_COMPONENT_ID,
    isRegistered: Boolean(trace.component?.isRegistered),
    source: trace.component?.source || (trace.component?.isRegistered ? "ds" : "none"),
    componentName: trace.component?.name || trace.component?.id || "",
    codeSource: trace.codeSource || {},
    screenFile: files.screen || `screens/${trace.screenId || "home"}.html`,
    styleFile: files.style || "styles/proto.css",
    manifestFile: files.manifest || null,
    registryFile: files.registry || "design/ds/registry.json",
    componentFiles,
    frameworks: [...new Set(componentFiles.map((entry) => entry.framework))],
    code: trace.code || {}
  };
}

/**
 * @param {ReturnType<typeof normalizeElementMapping>} mapping
 * @returns {{ nodeId: string, component: string, selector: string, file: string }}
 */
export const SOURCE_LABELS = { extracted: "Componente", ds: "Design System", none: "Só HTML + CSS" };

export function elementContextPayload(mapping) {
  return {
    nodeId: mapping.nodeId,
    component: mapping.componentId,
    selector: mapping.nodeId ? `[data-node-id="${mapping.nodeId}"]` : "",
    file: mapping.screenFile
  };
}

/**
 * @param {ReturnType<typeof normalizeElementMapping>} mapping
 * @returns {string}
 */
export function renderElementMappingHtml(mapping) {
  const componentState = SOURCE_LABELS[mapping.source] || "Fallback";
  const frameworks = mapping.frameworks.length ? mapping.frameworks.join(", ") : "nenhum";
  const componentFiles = mapping.componentFiles.length
    ? mapping.componentFiles
        .map((entry) => `<li><code>${esc(entry.path)}</code>${entry.entry ? ' <span class="element-map-entry">entrada</span>' : ""}</li>`)
        .join("")
    : `<li>Sem implementação registrada; editar <code>${esc(mapping.screenFile)}</code>.</li>`;
  const manifestRow = mapping.manifestFile
    ? `<li><i class="fa-solid fa-file-code"></i> <code>${esc(mapping.manifestFile)}</code></li>`
    : "";

  return `
    <div class="element-map-head">
      <strong><i class="fa-solid fa-diagram-project"></i> Mapeamento</strong>
      <span class="element-map-badge ${mapping.source !== "none" ? "is-registered" : "is-fallback"}">${componentState}</span>
    </div>
    <div class="element-map-component"><i class="fa-solid fa-cube"></i> <code>${esc(mapping.componentId)}</code></div>
    <ul class="element-map-files">
      <li><i class="fa-solid fa-file-code"></i> <code>${esc(mapping.screenFile)}</code></li>
      <li><i class="fa-solid fa-palette"></i> <code>${esc(mapping.styleFile)}</code></li>
      <li><i class="fa-solid fa-book"></i> <code>${esc(mapping.registryFile)}</code></li>
      ${manifestRow}
    </ul>
    <div class="element-map-frameworks"><i class="fa-solid fa-layer-group"></i> Frameworks: ${esc(frameworks)}</div>
    <ul class="element-map-files element-map-files--components">${componentFiles}</ul>
    <button type="button" class="btn-proto-vp element-map-send" data-element-map-chat>
      <i class="fa-solid fa-comment-dots"></i> Enviar para o chat
    </button>
    ${mapping.source === "extracted" ? `<button type="button" class="btn-proto-vp element-map-send" data-element-map-unextract>
      <i class="fa-solid fa-rotate-left"></i> Desfazer componente
    </button>` : ""}`;
}

/**
 * @param {ReturnType<typeof normalizeElementMapping>} mapping
 * @returns {boolean}
 */
export function insertElementMappingIntoChat(mapping) {
  const inserted = insertStudioContext("element", elementContextPayload(mapping));
  if (inserted) showToast("Elemento, arquivo e componente enviados ao chat do Studio.");
  else showToast("Não foi possível inserir o contexto do elemento no chat.");
  return inserted;
}

/**
 * Consulta e renderiza o mapeamento do nó selecionado no Ateliê.
 * @param {{ slug: string, protoId: string, screenId: string, node: any, host?: HTMLElement | null, fetchImpl?: typeof fetch }} options
 * @returns {Promise<ReturnType<typeof normalizeElementMapping> | null>}
 */
export async function renderElementMapping({ slug, protoId, screenId, node, host = null, fetchImpl }) {
  lastCall = { slug, protoId, screenId, node, host, fetchImpl };
  const container = host || (typeof document !== "undefined" ? $("atelierElementMap") : null);
  if (!container) return null;

  const nodeId = node?.nodeId || node?.pid || "";
  if (!nodeId) {
    container.innerHTML = `<span><i class="fa-solid fa-diagram-project"></i> Selecione um elemento para mapear arquivo e componente.</span>`;
    return null;
  }

  container.innerHTML = `<span><i class="fa-solid fa-spinner fa-spin"></i> Mapeando elemento...</span>`;
  try {
    const trace = await fetchElementTraceability({ slug, protoId, screenId, nodeId }, fetchImpl);
    const mapping = normalizeElementMapping(trace);
    container.innerHTML = renderElementMappingHtml(mapping);
    container.querySelector("[data-element-map-chat]")?.addEventListener("click", () => {
      insertElementMappingIntoChat(mapping);
    });
    container.querySelector("[data-element-map-unextract]")?.addEventListener("click", async () => {
      const done = await unextractComponent({ slug, protoId, screenId, pid: nodeId });
      if (done) notifyComponentChange(slug);
    });
    return mapping;
  } catch (error) {
    container.innerHTML = `<span class="element-map-error"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(error?.message || String(error))}</span>`;
    return null;
  }
}

/** @type {any} */
let lastCall = null;

/**
 * Desfaz a extração do elemento: ele deixa de ser componente, mas segue com HTML e CSS.
 * @param {{ slug: string, protoId: string, screenId: string, pid: string }} input
 */
export async function unextractComponent({ slug, protoId, screenId, pid }) {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/unextract-component`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, screen: screenId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Falha HTTP ${res.status}`);
    showToast("Componente desfeito. O elemento segue com HTML e CSS.");
    return true;
  } catch (err) {
    showToast(`Erro: ${err?.message || err}`);
    return false;
  }
}

/** Avisa o quadro de componentes e o painel de mapeamento que a lista mudou (sem F5). */
export function notifyComponentChange(slug) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("harness:design-index-changed", { detail: { slug } }));
  if (lastCall) renderElementMapping(lastCall);
}

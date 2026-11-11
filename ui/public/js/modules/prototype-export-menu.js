// @ts-check
import { $, showToast } from "../shared/dom.js";

/**
 * Exportar pacote do Ateliê: ZIP com protótipos, design system, servidor MCP e guias (MAPA.md, AGENTS.md, .mcp.json),
 * para outra pessoa continuar prototipando com Claude ou outro motor seguindo os mesmos padrões.
 */

/** HTML do botão da barra superior e do painel de opções. */
export function renderExportMenu() {
  return `
    <button type="button" id="btnAtelierExport" class="btn-proto-vp" title="Exportar protótipo e design system para outra pessoa continuar" aria-expanded="false"><i class="fa-solid fa-file-export"></i> Exportar</button>`;
}

export function renderExportPanel() {
  return `
    <div id="atelierExportPanel" class="proto-export" hidden>
      <div class="proto-export__head"><i class="fa-solid fa-file-export"></i> Exportar pacote<button type="button" class="proto-panel-action-btn" data-export-close title="Fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>
      <label class="proto-export__opt"><input type="checkbox" id="exportOptCurrent" checked> <span>Este protótipo</span></label>
      <label class="proto-export__opt"><input type="checkbox" id="exportOptAll"> <span>Todos os protótipos do projeto</span></label>
      <label class="proto-export__opt"><input type="checkbox" id="exportOptDs" checked> <span>Design system (tokens, componentes e vitrine navegável)</span></label>
      <label class="proto-export__opt"><input type="checkbox" id="exportOptMcp" checked> <span>Servidor MCP do design system</span></label>
      <div class="proto-export__hint">O ZIP inclui MAPA.md, AGENTS.md, CLAUDE.md, README e .mcp.json com caminhos relativos, e uma prévia HTML de cada protótipo.</div>
      <button type="button" id="btnExportDownload" class="btn-proto-vp proto-export__go"><i class="fa-solid fa-download"></i> Baixar pacote (.zip)</button>
    </div>`;
}

/**
 * @param {{ slug: string, protos: string[] | "all", ds: boolean, mcp: boolean }} options
 */
export function handoffUrl({ slug, protos, ds, mcp }) {
  const query = new URLSearchParams({ protos: protos === "all" ? "all" : protos.join(","), ds: ds ? "1" : "0", mcp: mcp ? "1" : "0" });
  return `/api/project/${encodeURIComponent(slug)}/design/export/handoff?${query}`;
}

/**
 * Baixa o ZIP; erros do servidor viram aviso em vez de abrir uma página de JSON.
 * @param {{ slug: string, protos: string[] | "all", ds: boolean, mcp: boolean }} options
 */
export async function downloadHandoff(options) {
  try {
    const res = await fetch(handoffUrl(options));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Não foi possível exportar o pacote.", 5000);
      return false;
    }
    const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = match ? match[1] : `${options.slug}-handoff.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    showToast("Falha de rede ao exportar o pacote.", 5000);
    return false;
  }
}

/** @param {string} id */
const checked = (id) => Boolean(/** @type {HTMLInputElement | null} */ ($(id))?.checked);

/**
 * @param {{ slug: string, protoId: string }} context
 */
export function mountExportMenu(context) {
  const button = $("btnAtelierExport");
  const panel = $("atelierExportPanel");
  if (!button || !panel) return;
  const setOpen = (open) => {
    panel.hidden = !open;
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.onclick = () => setOpen(panel.hidden);
  panel.onclick = (event) => {
    if (/** @type {HTMLElement} */ (event.target).closest("[data-export-close]")) setOpen(false);
  };
  const all = /** @type {HTMLInputElement | null} */ ($("exportOptAll"));
  const current = /** @type {HTMLInputElement | null} */ ($("exportOptCurrent"));
  if (all && current) {
    all.onchange = () => { if (all.checked) current.checked = true; };
    current.onchange = () => { if (!current.checked) all.checked = false; };
  }
  const go = $("btnExportDownload");
  if (go) go.onclick = async () => {
    const protos = checked("exportOptAll") ? "all" : checked("exportOptCurrent") ? [context.protoId] : [];
    go.setAttribute("disabled", "");
    const ok = await downloadHandoff({ slug: context.slug, protos, ds: checked("exportOptDs"), mcp: checked("exportOptMcp") });
    go.removeAttribute("disabled");
    if (ok) setOpen(false);
  };
}

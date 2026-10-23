// @ts-check
// Gerenciador de alternância entre as visualizações do Studio: Código, Design e Preview.
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sts } from "./studio-store.js";
import { updateCompanionDetails } from "./studio-companion.js";
import { isStudioSourceColumnOpen, setStudioSourceColumn, getStoredSourceColumnOpen } from "./studio-source-column.js";
import { detachStudioSidebarFromAtelier } from "./prototype-atelier-sidebar.js";
import { resetAtelierPromptState, setAtelierChatContext } from "./prototype-chat-bridge.js";
import { readAtelierState } from "./prototype-atelier-state.js";
import { saveStudioState } from "./studio-state.js";

export const STUDIO_VIEW_MODES = {
  PREVIEW: "iframe",
  COMPANION: "companion",
  DESIGN: "design",
  CODE: "source",
};

export const STUDIO_VIEW_STORAGE_PREFIX = "harness_studio_active_view";

/**
 * Normaliza os identificadores ou aliases para o modo canônico.
 * @param {string} mode
 * @returns {string}
 */
export function normalizeStudioViewMode(mode) {
  if (!mode) return STUDIO_VIEW_MODES.PREVIEW;
  const m = String(mode).toLowerCase().trim();
  if (m === "preview" || m === "iframe") return STUDIO_VIEW_MODES.PREVIEW;
  if (m === "code" || m === "source" || m === "codigo") return STUDIO_VIEW_MODES.CODE;
  if (m === "design" || m === "atelie" || m === "atelier") return STUDIO_VIEW_MODES.DESIGN;
  if (m === "companion" || m === "2telas") return STUDIO_VIEW_MODES.COMPANION;
  return m;
}

/**
 * Retorna a chave de armazenamento de visualização isolada por projeto.
 * @param {string} [slug]
 * @returns {string}
 */
export function resolveViewStorageKey(slug = state.activeProject) {
  return slug ? `${STUDIO_VIEW_STORAGE_PREFIX}_${slug}` : STUDIO_VIEW_STORAGE_PREFIX;
}

/**
 * Verifica se a troca de visualização pode prosseguir sem perder trabalho não salvo.
 * @param {string} targetMode
 * @returns {boolean}
 */
export function canSwitchStudioView(targetMode) {
  const current = normalizeStudioViewMode(sts.currentStudioMode);
  const target = normalizeStudioViewMode(targetMode);
  if (current === target) return true;
  // O código vive em coluna própria; trocar a visão do preview não descarta o editor.
  return true;
}

function hasUnsavedSource() {
  const appWindow = /** @type {any} */ (typeof window !== "undefined" ? window : globalThis);
  return Boolean(appWindow.hasUnsavedStudioSource?.());
}

function confirmDiscardSource() {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  return window.confirm("Descartar as alterações manuais de código ainda não salvas?");
}

/**
 * Monta ou reutiliza o container de Design / Ateliê no Studio.
 * @param {HTMLElement | null} [wrapper]
 * @returns {HTMLElement | null}
 */
export function mountStudioDesignWorkspace(wrapper = $("studioFrameWrapper")) {
  if (typeof document === "undefined") return null;
  let workspace = $("studioDesignWorkspace");
  if (!workspace && wrapper) {
    workspace = document.createElement("section");
    workspace.id = "studioDesignWorkspace";
    workspace.className = "studio-design-workspace";
    workspace.setAttribute("aria-label", "Ateliê de Design e Protótipos");
    workspace.style.display = "none";
    workspace.innerHTML = `
      <div id="studioDesignHost" class="studio-design-host" style="width:100%;height:100%;display:flex;flex-direction:column">
        <div class="proto-loading" style="padding:24px;text-align:center;color:var(--mute)">
          <i class="fa-solid fa-spinner fa-spin"></i> Inicializando Ateliê de Design...
        </div>
      </div>
    `;
    wrapper.appendChild(workspace);
  }
  return workspace;
}

/**
 * Dispara o carregamento do conteúdo de protótipos/design.
 * @param {string} [slug]
 */
export async function loadStudioDesignContent(slug = state.activeProject) {
  if (typeof window === "undefined" || !slug) return;
  const host = $("studioDesignHost");
  if (!host) return;

  try {
    const designProtoMod = await import("./design-prototypes.js").catch(() => null);
    if (designProtoMod && typeof designProtoMod.renderPrototypesWorkspace === "function") {
      const saved = await readAtelierState().catch(() => null);
      const initial = saved?.activePrototype ? { id: String(saved.activePrototype), kind: "atelier" } : null;
      await designProtoMod.renderPrototypesWorkspace(host, slug, [], [], {}, initial);
      return;
    }
  } catch (err) {
    console.warn("Falha ao carregar módulo de design de protótipos:", err);
  }

  host.innerHTML = `
    <div style="padding:32px 20px;text-align:center;color:var(--mute)">
      <div style="font-size:28px;margin-bottom:8px;color:var(--accent)"><i class="fa-solid fa-pen-ruler"></i></div>
      <h3 style="margin:0 0 6px;color:var(--text)">Ateliê Visual de Design</h3>
      <p style="font-size:13px;max-width:440px;margin:0 auto 16px">Nenhum protótipo interativo encontrado para o projeto <b>${slug}</b>.</p>
    </div>
  `;
}

/**
 * Alterna a visualização ativa do Studio entre Código, Design, Preview e 2 Telas.
 * @param {string} targetMode
 * @param {object} [options]
 * @param {boolean} [options.force]
 * @returns {boolean} Retorna true se a troca foi executada
 */
export function switchStudioView(targetMode, options = {}) {
  const mode = normalizeStudioViewMode(targetMode);

  // Código é a terceira coluna (chat | preview | código): alterna sem trocar o modo do preview.
  if (mode === STUDIO_VIEW_MODES.CODE) {
    const open = !isStudioSourceColumnOpen();
    if (!open && !options.force && hasUnsavedSource() && !confirmDiscardSource()) return false;
    setStudioSourceColumn(open);
    return true;
  }

  if (!options.force && !canSwitchStudioView(mode)) {
    return false;
  }

  sts.currentStudioMode = mode;

  void saveStudioState({ activeView: mode });

  // Atualiza botões no grupo de visualização
  const btnIframe = $("btnViewIframe");
  const btnCompanion = $("btnViewCompanion");
  const btnDesign = $("btnViewDesign");

  if (btnIframe) btnIframe.classList.toggle("active", mode === STUDIO_VIEW_MODES.PREVIEW);
  if (btnCompanion) btnCompanion.classList.toggle("active", mode === STUDIO_VIEW_MODES.COMPANION);
  if (btnDesign) btnDesign.classList.toggle("active", mode === STUDIO_VIEW_MODES.DESIGN);

  // Atualiza botões no drawer mobile se existirem
  const btnDrawerIframe = $("btnDrawerIframe");
  const btnDrawerCompanion = $("btnDrawerCompanion");
  const btnDrawerDesign = $("btnDrawerDesign");

  if (btnDrawerIframe) btnDrawerIframe.classList.toggle("active", mode === STUDIO_VIEW_MODES.PREVIEW);
  if (btnDrawerCompanion) btnDrawerCompanion.classList.toggle("active", mode === STUDIO_VIEW_MODES.COMPANION);
  if (btnDrawerDesign) btnDrawerDesign.classList.toggle("active", mode === STUDIO_VIEW_MODES.DESIGN);

  // Alterna classes de modo e visibilidade dos containers
  const ws = $("studioWorkspace");
  if (ws) ws.classList.toggle("mode-2telas", mode === STUDIO_VIEW_MODES.COMPANION);

  const frameContainer = $("studioViewportContainer");
  const companionContainer = $("studioCompanionContainer");
  let designContainer = $("studioDesignWorkspace");
  const vpBar = $("canvasViewportBar");
  const banner = $("studio2TelasBanner");

  if (frameContainer) frameContainer.style.display = mode === STUDIO_VIEW_MODES.PREVIEW ? "flex" : "none";
  if (companionContainer) companionContainer.style.display = mode === STUDIO_VIEW_MODES.COMPANION ? "flex" : "none";

  if (mode === STUDIO_VIEW_MODES.DESIGN) {
    if (!designContainer) designContainer = mountStudioDesignWorkspace();
    if (designContainer) designContainer.style.display = "flex";
  } else if (designContainer) {
    // Sair do Ateliê não pode esconder o chat junto com o workspace: devolve o painel ao Studio.
    detachStudioSidebarFromAtelier();
    setAtelierChatContext(null);
    resetAtelierPromptState();
    designContainer.style.display = "none";
  }

  // Barra de ferramentas de viewport ativa para preview
  if (vpBar) vpBar.style.display = mode === STUDIO_VIEW_MODES.PREVIEW ? "flex" : "none";

  if (banner) {
    banner.style.display = mode === STUDIO_VIEW_MODES.COMPANION ? "flex" : "none";
    const bannerUrl = $("bannerAppUrl");
    if (bannerUrl) bannerUrl.textContent = sts.currentAppUrl;
  }

  // Ações específicas de inicialização sob demanda
  const appWindow = /** @type {any} */ (typeof window !== "undefined" ? window : globalThis);
  if (mode === STUDIO_VIEW_MODES.COMPANION) {
    updateCompanionDetails();
  } else if (mode === STUDIO_VIEW_MODES.DESIGN) {
    loadStudioDesignContent();
  }

  return true;
}

/**
 * Inicializa a visualização do Studio restaurando a preferência salva ou o padrão.
 * @param {string} [preferredMode]
 */
export function initStudioViews(preferredMode) {
  const mode = preferredMode;
  // Preferências antigas guardavam "source" como modo exclusivo: viram preview + coluna aberta.
  const legacyCode = normalizeStudioViewMode(mode) === STUDIO_VIEW_MODES.CODE;
  switchStudioView(legacyCode || !mode ? STUDIO_VIEW_MODES.PREVIEW : mode, { force: true });
  if (legacyCode || getStoredSourceColumnOpen()) setStudioSourceColumn(true);
}

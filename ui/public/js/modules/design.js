// @ts-check
import { $, showToast, esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { renderKanbanBoard } from "./design-board.js";
import { renderLayersWorkspace } from "./design-layers.js";
import { renderAuditWorkspace } from "./design-audit.js";
import { renderPrototypesWorkspace } from "./design-prototypes.js";
import { renderArtifactsWorkspace } from "./design-artifacts.js";
import { renderRoutinesWorkspace } from "./design-routines.js";
import { renderScrumWorkspace } from "./design-scrum.js";
import { detachStudioSidebarFromAtelier } from "./prototype-atelier-sidebar.js";
import { resetAtelierPromptState, setAtelierChatContext } from "./prototype-chat-bridge.js";
import { persistDesignView, restoredDesignView } from "./design-view-state.js";

let currentDesignData = null;
let currentScreensData = null;
let currentAuditData = null;
let currentScrumData = null;
let currentProfileData = null;
let currentArtifactsData = null;
let currentView = "scrum"; // 'layers' | 'board' | 'scrum' | 'audit' | 'prototypes' | 'artifacts'
let isDesignActive = false;
let lastLoadedSlug = "";

/** @type {Map<string, any>} */
const draftsBySlug = new Map();

// Extrair ou desfazer componente no Ateliê: atualiza os dados e, se o quadro estiver aberto, redesenha (sem F5).
if (typeof window !== "undefined") {
  window.addEventListener("harness:design-index-changed", async (e) => {
    const slug = /** @type {CustomEvent} */ (e).detail?.slug || state.P?.name || state.S?.active;
    if (!slug) return;
    await loadAllProjectDesignData(slug);
    if (isDesignActive && currentView === "board") renderCurrentDesignView();
  });

  window.addEventListener("harness:open-layer-target", (e) => {
    const detail = /** @type {CustomEvent} */ (e).detail || {};
    if (!detail.route && !detail.screenId) return;
    const win = /** @type {any} */ (window);
    setDesignView("layers");
    if (win.openLayersTarget?.(detail.route, detail.fieldId)) return;
    win.selectActiveScreen?.(detail.screenId);
    if (detail.fieldId) win.setFocusedField?.(detail.fieldId);
    win.setLayerTab?.("ui");
  });
}

export async function loadAllProjectDesignData(slug) {
  if (slug !== lastLoadedSlug) {
    lastLoadedSlug = slug;
  }
  try {
    const [resProfile, resIndex, resScreens, resAudit, resScrum, resArtifacts] = await Promise.all([
      fetch(`/api/project/${encodeURIComponent(slug)}/design/profile`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/index`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/screens`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/audit`),
      fetch(`/api/project/${encodeURIComponent(slug)}/scrum`),
      fetch(`/api/project/${encodeURIComponent(slug)}/artifacts`),
    ]);

    if (resProfile.ok) currentProfileData = await resProfile.json();
    if (resIndex.ok) currentDesignData = await resIndex.json();
    if (resScreens.ok) currentScreensData = await resScreens.json();
    if (resAudit.ok) currentAuditData = await resAudit.json();
    if (resArtifacts.ok) currentArtifactsData = await resArtifacts.json();
    if (resScrum.ok) {
      const scrumJson = await resScrum.json();
      currentScrumData = scrumJson.scrum;
    }

    renderProfileBannerIfNeeded(slug);
    return { profile: currentProfileData, design: currentDesignData, screens: currentScreensData, audit: currentAuditData, scrum: currentScrumData, artifacts: currentArtifactsData };
  } catch (err) {
    showToast("Falha de conexão com os serviços de design e projeto.");
    return null;
  }
}

function renderProfileBannerIfNeeded(slug) {
  const bar = $("designNavTabs");
  if (!bar) return;
  const existingBanner = $("designProfileBanner");
  if (existingBanner) existingBanner.remove();

  if (currentProfileData?.profile?.isGeneric && !currentProfileData?.profile?.hasProfileFile) {
    const banner = document.createElement("div");
    banner.id = "designProfileBanner";
    banner.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 10px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);border-radius:6px;font-size:11px;color:#eab308;margin-left:auto;";
    banner.innerHTML = `
      <span><i class="fa-solid fa-gear"></i> Perfil genérico ativo</span>
      <button type="button" id="btnDetectProfile" style="background:#eab308;color:#000;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-weight:600">Configurar Projeto</button>
    `;
    bar.appendChild(banner);

    const btn = $("btnDetectProfile");
    if (btn) btn.onclick = () => openProfileAssistantModal(slug);
  }
}

async function openProfileAssistantModal(slug) {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/profile/detect`, { method: "POST" });
    if (!res.ok) throw new Error("Erro na detecção do projeto.");
    const data = await res.json();
    const proposal = data.proposal || {};
    const proposalJson = JSON.stringify(proposal, null, 2);

    const modal = document.createElement("div");
    modal.id = "designProfileModal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;";
    modal.innerHTML = `
      <div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:20px;max-width:550px;width:90%;color:#f3f4f6;">
        <h3 style="margin-top:0;font-size:15px;color:#60a5fa">Assistente de Configuração de Design</h3>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:10px">O Harness detectou automaticamente a seguinte estrutura para este projeto. Confirme para salvar o <code>profile.json</code>:</p>
        <pre style="background:#030712;padding:12px;border-radius:6px;font-size:11px;max-height:220px;overflow:auto;color:#34d399;border:1px solid #1f2937">${esc(proposalJson)}</pre>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button type="button" id="btnCancelProfileModal" style="background:transparent;border:1px solid #4b5563;color:#d1d5db;padding:6px 12px;border-radius:4px;cursor:pointer">Cancelar</button>
          <button type="button" id="btnConfirmProfileModal" style="background:#2563eb;border:none;color:#fff;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600">Salvar profile.json</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $("btnCancelProfileModal").onclick = () => modal.remove();
    $("btnConfirmProfileModal").onclick = async () => {
      try {
        const saveRes = await fetch(`/api/project/${encodeURIComponent(slug)}/design/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: proposal }),
        });
        if (saveRes.ok) {
          showToast("✔ Perfil salvo com sucesso!");
          modal.remove();
          await loadAllProjectDesignData(slug);
          renderCurrentDesignView();
        } else {
          const err = await saveRes.json();
          showToast("Erro ao salvar: " + (err.error || "Acesso negado"));
        }
      } catch (e) {
        showToast("Erro na requisição de salvamento.");
      }
    };
  } catch (err) {
    showToast("Falha ao detectar perfil do repositório.");
  }
}

export function setDesignView(view) {
  detachStudioSidebarFromAtelier();
  // Saiu do Ateliê: o chat volta a ser um chat comum (e o prompt perde o código do protótipo anterior).
  setAtelierChatContext(null);
  resetAtelierPromptState();
  currentView = view;
  persistDesignView(view, true);
  const tabs = document.querySelectorAll(".design-nav-tab");
  tabs.forEach((t) => {
    // @ts-ignore
    t.classList.toggle("active", t.dataset.view === view);
  });
  renderCurrentDesignView();
}

function renderCurrentDesignView() {
  const container = $("designViewContainer");
  if (!container) return;
  const slug = state.P?.name || state.S?.active;
  const activeDraft = draftsBySlug.get(slug) || null;

  if (currentView === "scrum") {
    renderScrumWorkspace(container, slug, currentScrumData);
  } else if (currentView === "layers") {
    renderLayersWorkspace(container, slug, currentScreensData || { screens: [] });
  } else if (currentView === "board") {
    renderKanbanBoard(container, currentDesignData?.components || [], activeDraft);
  } else if (currentView === "audit") {
    renderAuditWorkspace(container, slug, currentAuditData);
  } else if (currentView === "prototypes") {
    renderPrototypesWorkspace(
      container,
      slug,
      currentDesignData?.prototypes || [],
      currentDesignData?.components || [],
      currentDesignData?.designSystem || {},
    );
  } else if (currentView === "artifacts") {
    renderArtifactsWorkspace(container, slug, currentArtifactsData, async () => {
      await loadAllProjectDesignData(slug);
      if (currentView === "artifacts") renderCurrentDesignView();
    });
  } else if (currentView === "routines") {
    renderRoutinesWorkspace(container, slug);
  }
}

export async function toggleDesignMode(force, targetView) {
  isDesignActive = force != null ? !!force : !isDesignActive;
  const btn = $("btnToggleDesign");
  const mainDash = $("mainDashboard");
  const designWs = $("designWorkspace");
  const studioWs = $("studioWorkspace");

  if (targetView) {
    currentView = targetView;
  } else if (isDesignActive) {
    currentView = await restoredDesignView();
  }
  persistDesignView(currentView, isDesignActive);

  if (isDesignActive) {
    if (state.isStudioMode && window.toggleStudioMode) {
      window.toggleStudioMode(false);
    }
    if (studioWs) studioWs.style.display = "none";
    if (mainDash) mainDash.style.display = "none";
    if (designWs) designWs.style.display = "flex";
    if (btn) btn.classList.add("active", "nav-module-active");
    const tabs = document.querySelectorAll(".design-nav-tab");
    tabs.forEach((t) => {
      // @ts-ignore
      t.classList.toggle("active", t.dataset.view === currentView);
    });
    const slug = state.P?.name || state.S?.active;
    if (slug) {
      await loadAllProjectDesignData(slug);
      renderCurrentDesignView();
    }
  } else {
    detachStudioSidebarFromAtelier();
    setAtelierChatContext(null);
    resetAtelierPromptState();
    if (designWs) designWs.style.display = "none";
    if (mainDash) mainDash.style.display = "grid";
    if (btn) btn.classList.remove("active", "nav-module-active");
  }
}

export async function openDesignWithDraft(draft) {
  const slug = state.P?.name || state.S?.active || "";
  const normName = (draft.component || "NovoComponente").replace(/^[_ɵ]+/, "").trim();
  let selector = draft.selector;
  if (!selector || ["div", "span", "p", "button", "section", "article"].includes(selector.toLowerCase())) {
    selector = draft.elementTag && draft.elementTag.includes("-")
      ? draft.elementTag
      : normName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/-component$/, "");
  }
  const tsPath = typeof draft.files?.ts === "string" ? draft.files.ts : draft.files?.ts?.path || null;
  const alreadyExists = Boolean(draft.found || tsPath);

  const draftObj = {
    id: normName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
    name: normName,
    selector,
    alreadyExists,
    existingPath: tsPath,
    feature: "geral",
    stage: alreadyExists ? "implemented" : "extracted",
    stageLabel: alreadyExists ? "Implementado" : "Extraído",
    checklist: { inPrototype: false, isExtracted: true, inDesignSystem: false, hasBoilerplate: false, isImplemented: alreadyExists, isDocumented: false },
    files: { target: tsPath },
    dai: {
      agentId: "ux-ui-designer",
      agentName: "UX/UI Designer",
      icon: "📐",
      nextStage: alreadyExists ? "documented" : "design_system",
      nextStageLabel: alreadyExists ? "Documentado" : "No design system",
      nextAction: alreadyExists ? `Componente já existe no app (${tsPath}).` : "Definir interface no Design System",
    },
  };

  draftsBySlug.set(slug, draftObj);
  await toggleDesignMode(true);
  setDesignView("board");
  showToast(alreadyExists ? `📐 ${draftObj.name}: já existe no app.` : `📐 Rascunho de ${draftObj.name} carregado no Kanban.`);
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.toggleDesignMode = toggleDesignMode;
  // @ts-ignore
  window.setDesignView = setDesignView;
  // @ts-ignore
  window.openDesignWithDraft = openDesignWithDraft;
  // @ts-ignore
  window.loadAllProjectDesignData = loadAllProjectDesignData;
}

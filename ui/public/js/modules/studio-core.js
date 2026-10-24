// @ts-check
// Modo Studio, abas mobile, conexão remota e controles.
import { esc, copyToClipboard } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sts } from "./studio-store.js";
import { renderCanvasRouteChips, checkAppStatus, setStudioModeType } from "./studio-canvas.js";
import { updateCompanionDetails } from "./studio-companion.js";
import { initStudioAdoption } from "./studio-adoption.js";
import { saveStudioState } from "./studio-state.js";
import { getRouter, routeTo } from "../shared/router.js";
import {
  STUDIO_RESIZE_STEP,
  STUDIO_DEFAULT_SIDEBAR_WIDTH,
  calculateSidebarBounds,
  clampSidebarWidth,
} from "./studio-layout.js";

export function toggleStudioMode(force) {
  // A classe do body é a fonte de verdade: o Ateliê move o chat do Studio e antes deixava state.isStudioMode "ligado" sem o modo estar ativo.
  state.isStudioMode = force != null ? !!force : !document.body.classList.contains("studio-active");
  document.body.classList.toggle("studio-active", state.isStudioMode);
  const btn = $("btnToggleStudio");
  if (btn) {
    btn.classList.toggle("active", state.isStudioMode);
    btn.classList.toggle("nav-module-active", state.isStudioMode);
  }

  const dlg = /** @type {any} */ ($("chatDlg"));
  if (dlg && dlg.open) dlg.close();

  if (state.isStudioMode) {
    if (window.toggleDesignMode && $("designWorkspace")?.style.display !== "none") {
      window.toggleDesignMode(false);
    }
    if (window.hideMiniChatWidget) window.hideMiniChatWidget();
    routeTo("studio", [], { push: true });
    void initStudioAdoption();
    syncStudioControls();
    if (window.renderChatHistory) window.renderChatHistory();
    checkAppStatus();
    setTimeout(() => {
      const inp = $("studioChatInput");
      if (inp) inp.focus();
    }, 80);
  } else {
    // Only when leaving the Studio itself: opening another screen has already put its own route in the address.
    if (getRouter()?.current().screen === "studio") routeTo("chats", [], { push: true });
    if (window.renderChatHistory) window.renderChatHistory();
    if (state.chatTurns.length > 0 && window.updateMiniChatWidget) window.updateMiniChatWidget();
  }
}

export function setMobileStudioTab(tab) {
  sts.currentMobileStudioTab = tab;
  const ws = $("studioWorkspace");
  if (ws) ws.classList.toggle("mobile-show-chat", tab === "chat");
  const bApp = $("btnMobileTabApp");
  const bChat = $("btnMobileTabChat");
  if (bApp) bApp.classList.toggle("active", tab === "app");
  if (bChat) bChat.classList.toggle("active", tab === "chat");
  if (tab === "chat") {
    const dot = $("mobileChatDot");
    if (dot) dot.style.display = "none";
    const inp = $("studioChatInput");
    if (inp) setTimeout(() => inp.focus(), 60);
  } else if (tab === "app") {
    setStudioModeType("iframe");
    checkAppStatus();
  }
}

export async function openRemoteConnectModal() {
  /** @type {any} */ const dlg = $("remoteConnectDlg");
  if (!dlg) return;
  dlg.showModal();

  try {
    const res = await fetch("/api/remote/info");
    const data = await res.json();
    sts.remoteInfoCache = data;

    const qrBox = $("remoteQrContainer");
    if (qrBox && data.svgQr) {
      qrBox.innerHTML = data.svgQr;
    }

    const pinBox = $("remotePinDisplay");
    if (pinBox) {
      pinBox.textContent = data.pin || "SEM PIN";
    }

    const appHint = $("remoteAppUrlHint");
    if (appHint && data.appUrl) {
      appHint.textContent = data.appUrl;
    }

    const linksBox = $("remoteLinksList");
    if (linksBox && Array.isArray(data.urls)) {
      linksBox.innerHTML = data.urls
        .map(
          (u) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">
          <div style="min-width:0;flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${esc(u.label)}</div>
            <a href="${esc(u.url)}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;word-break:break-all">${esc(u.url)}</a>
          </div>
          <button type="button" class="btn-vp" onclick="copyToClipboard('${esc(u.url)}', 'Link copiado!')" style="font-size:11px;padding:4px 8px;flex-shrink:0">Copiar</button>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("[remote/info]", err);
  }
}

export function copyRemotePin() {
  if (sts.remoteInfoCache && sts.remoteInfoCache.pin) {
    copyToClipboard(sts.remoteInfoCache.pin, "PIN copiado!");
  }
}

export function syncStudioControls() {
  const P = state.P;
  if (window.updateEngineControls) window.updateEngineControls();
  if (window.renderDaiSelectors) window.renderDaiSelectors();
  if (P && P.app) {
    const isRemoteClient = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
    if (isRemoteClient && (!sts.currentAppUrl || sts.currentAppUrl.includes("localhost") || sts.currentAppUrl.includes("127.0.0.1"))) {
      sts.currentAppUrl = "/preview/";
    } else {
      sts.currentAppUrl = P.app.url || sts.currentAppUrl;
    }
    const inp = /** @type {HTMLInputElement} */ ($("canvasUrlInput"));
    if (inp) inp.value = isRemoteClient ? location.origin + "/preview/" : sts.currentAppUrl;
    renderCanvasRouteChips(P.app.routes || []);
  } else {
    const inp = /** @type {HTMLInputElement} */ ($("canvasUrlInput"));
    if (inp && inp.value) sts.currentAppUrl = inp.value;
  }
  if (sts.currentStudioMode === "companion") {
    updateCompanionDetails();
  } else if (sts.currentStudioMode === "source") {
    /** @type {any} */ (window).loadStudioSourceWorkspace?.();
  }
  if (window.updateServiceStatusIndicators) window.updateServiceStatusIndicators();
  initStudioSidebarResizer();
}

let studioResizerInitialized = false;

function studioSidebarBounds() {
  return calculateSidebarBounds();
}

function setStudioSidebarWidth(sidebar, resizer, width, persist = false) {
  const { min, max } = studioSidebarBounds();
  const next = clampSidebarWidth(width);
  sidebar.style.width = `${next}px`;
  resizer.setAttribute("aria-valuemin", String(min));
  resizer.setAttribute("aria-valuemax", String(max));
  resizer.setAttribute("aria-valuenow", String(next));
  if (persist) {
    void saveStudioState({ sidebarWidth: next });
  }
  return next;
}

export function initStudioSidebarResizer() {
  if (studioResizerInitialized) return;
  const resizer = $("studioSidebarResizer");
  const sidebar = $("studioSidebar");
  const ws = $("studioWorkspace");
  if (!resizer || !sidebar || !ws) return;
  studioResizerInitialized = true;

  setStudioSidebarWidth(sidebar, resizer, sidebar.getBoundingClientRect().width || STUDIO_DEFAULT_SIDEBAR_WIDTH);

  let startX = 0;
  let startW = 0;
  let activePointerId = null;

  const onPointerMove = (e) => {
    if (activePointerId !== e.pointerId) return;
    const delta = e.clientX - startX;
    setStudioSidebarWidth(sidebar, resizer, startW + delta);
  };

  const onPointerUp = (e) => {
    if (activePointerId !== e.pointerId) return;
    document.body.classList.remove("studio-resizing");
    resizer.releasePointerCapture?.(e.pointerId);
    activePointerId = null;
    setStudioSidebarWidth(sidebar, resizer, parseInt(sidebar.style.width, 10), true);
  };

  resizer.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    document.body.classList.add("studio-resizing");
    resizer.setPointerCapture?.(e.pointerId);
  });
  resizer.addEventListener("pointermove", onPointerMove);
  resizer.addEventListener("pointerup", onPointerUp);
  resizer.addEventListener("pointercancel", onPointerUp);

  resizer.addEventListener("keydown", (e) => {
    const current = sidebar.getBoundingClientRect().width;
    const { min, max } = studioSidebarBounds();
    let next = null;
    if (e.key === "ArrowLeft") next = current - STUDIO_RESIZE_STEP;
    if (e.key === "ArrowRight") next = current + STUDIO_RESIZE_STEP;
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next == null) return;
    e.preventDefault();
    setStudioSidebarWidth(sidebar, resizer, next, true);
  });
}


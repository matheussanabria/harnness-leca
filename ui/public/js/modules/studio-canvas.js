// @ts-check
// Navegação do canvas, status do app e tipo de modo.
import { esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sts } from "./studio-store.js";
import { updateCompanionDetails } from "./studio-companion.js";
import { switchStudioView } from "./studio-views.js";

export function renderCanvasRouteChips(routes) {
  const box = $("canvasRouteChips");
  if (!box) return;
  if (!routes || !routes.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = routes
    .map((r) => `<button type="button" class="route-chip" onclick="navigateCanvasRoute('${esc(r.path)}')">${esc(r.label)}</button>`)
    .join("");
}

export function navigateCanvasRoute(path) {
  const isRemote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  if (isRemote) {
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    navigateCanvas("/preview" + cleanPath);
    return;
  }
  try {
    const base = new URL(sts.currentAppUrl, location.origin);
    base.pathname = path;
    navigateCanvas(base.href);
  } catch {
    navigateCanvas(sts.currentAppUrl.replace(/\/+$/, "") + path);
  }
}

export function navigateCanvas(url) {
  if (!url) return;
  const isRemote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  if (isRemote && (url.includes("localhost") || url.includes("127.0.0.1"))) {
    try {
      const u = new URL(url);
      url = "/preview" + ((u.pathname === "/" ? "" : u.pathname) + u.search + u.hash);
    } catch {
      url = "/preview/";
    }
  } else if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }
  sts.currentAppUrl = url;
  const inp = /** @type {HTMLInputElement} */ ($("canvasUrlInput"));
  if (inp) inp.value = isRemote && url.startsWith("/preview") ? location.origin + url : url;
  checkAppStatus();
}

export async function checkAppStatus(shouldShowToast) {
  const P = state.P;
  if (sts.appStatusChecking) return;
  sts.appStatusChecking = true;
  const dot = $("canvasStatusDot");
  if (dot) {
    dot.className = "status-dot checking";
    dot.title = "Verificando aplicação...";
  }
  const overlay = $("studioOfflineOverlay");
  const targetHelp = $("offlineTargetUrl");
  const isRemoteDev = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  if (targetHelp) targetHelp.textContent = isRemoteDev && sts.currentAppUrl.startsWith("/preview") ? location.origin + sts.currentAppUrl : sts.currentAppUrl;
  const cmdHelp = $("offlineCmdHelp");
  if (cmdHelp && P && P.app && P.app.command) {
    cmdHelp.textContent = `${P.app.command}${P.app.cwd ? " (em " + P.app.cwd + ")" : ""}`;
  }

  try {
    const pingTarget = sts.currentAppUrl.startsWith("/preview")
      ? P?.app?.url || "http://127.0.0.1:8081"
      : sts.currentAppUrl.startsWith("/")
      ? "http://127.0.0.1:8081" + sts.currentAppUrl
      : sts.currentAppUrl;
    const res = await fetch("/api/app/ping?url=" + encodeURIComponent(pingTarget));
    const data = await res.json();
    sts.appIsOnline = !!(data && data.alive);
    if (dot) {
      dot.className = "status-dot " + (sts.appIsOnline ? "online" : "offline");
      dot.title = sts.appIsOnline ? `Online (${sts.currentAppUrl})` : `Offline (${sts.currentAppUrl})`;
    }
    if (overlay) {
      overlay.style.display = sts.appIsOnline ? "none" : "flex";
    }
    const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
    const resolvedTarget = new URL(sts.currentAppUrl, location.origin).href;
    if (frame && sts.appIsOnline && (frame.src === "about:blank" || !frame.src || frame.src !== resolvedTarget)) {
      frame.src = resolvedTarget;
    }
    if (shouldShowToast) {
      showToast(sts.appIsOnline ? "✅ Aplicação online e conectada!" : "⚠️ Servidor dev não detectado na porta.");
    }
    if (sts.currentStudioMode === "companion") {
      updateCompanionDetails();
    }
    if (window.updateServiceStatusIndicators) window.updateServiceStatusIndicators();
  } catch {
    sts.appIsOnline = false;
    if (dot) dot.className = "status-dot offline";
    if (overlay) overlay.style.display = "flex";
    if (sts.currentStudioMode === "companion") {
      updateCompanionDetails();
    }
    if (window.updateServiceStatusIndicators) window.updateServiceStatusIndicators();
  } finally {
    sts.appStatusChecking = false;
  }
}

export function forceLoadIframe() {
  const overlay = $("studioOfflineOverlay");
  if (overlay) overlay.style.display = "none";
  const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
  if (frame) {
    const resolvedTarget = new URL(sts.currentAppUrl, location.origin).href;
    frame.src = resolvedTarget;
  }
}

export function reloadStudioIframe() {
  const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
  if (frame) {
    try {
      frame.contentWindow.location.reload();
    } catch {
      const resolvedTarget = new URL(sts.currentAppUrl, location.origin).href;
      const u = resolvedTarget.split("#")[0];
      const sep = u.includes("?") ? "&" : "?";
      frame.src = u + sep + "_harnesst=" + Date.now();
    }
  }
}

export function setStudioModeType(mode) {
  return switchStudioView(mode);
}

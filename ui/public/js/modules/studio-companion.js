// @ts-check
// Detalhes do companion, URL externa, viewport e chat do Studio.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { sts } from "./studio-store.js";
import { sendChatMessage } from "./chat-send.js";
import { handleStudioChatKey as baseHandleKey } from "./studio-chat.js";

export function updateCompanionDetails() {
  const P = state.P;
  const appName = (P && P.app && P.app.name) || "Aplicação Local";
  const elName = $("companionAppName");
  if (elName) elName.textContent = appName;
  const elUrl = $("companionAppUrl");
  const isRemote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  if (elUrl) elUrl.textContent = isRemote ? getExternalAppUrl() : sts.currentAppUrl;
  const elDot = $("companionStatusDot");
  if (elDot) {
    elDot.className = "status-dot " + (sts.appIsOnline ? "online" : "offline");
  }
  const elStatusTxt = $("companionStatusText");
  if (elStatusTxt) {
    elStatusTxt.textContent = sts.appIsOnline ? "Online e Conectada (HMR ativo)" : "Servidor dev offline";
  }
  const routeBox = $("companionRoutesList");
  if (routeBox) {
    const routes = (P && P.app && P.app.routes) || [
      { label: "Início", path: "/" },
      { label: "Pacientes", path: "/#/pacientes" },
    ];
    routeBox.innerHTML = routes
      .map((r) => `<button type="button" class="btn-vp" onclick="openCompanionRoute('${esc(r.path)}')">${esc(r.label)} (${esc(r.path)}) ↗</button>`)
      .join("");
  }
}

export function getExternalAppUrl(customPath) {
  const isRemote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

  if (!isRemote) {
    if (customPath) {
      try {
        const base = new URL(sts.currentAppUrl);
        if (customPath.startsWith("#")) base.hash = customPath;
        else base.pathname = customPath;
        return base.href;
      } catch {
        return sts.currentAppUrl.replace(/\/+$/, "") + (customPath.startsWith("/") ? customPath : "/" + customPath);
      }
    }
    return sts.currentAppUrl.startsWith("/") ? location.origin + sts.currentAppUrl : sts.currentAppUrl;
  }

  let sub = "";
  if (customPath) {
    sub = customPath.startsWith("/") ? customPath : "/" + customPath;
  } else if (sts.currentAppUrl.startsWith("/preview")) {
    sub = sts.currentAppUrl.replace(/^\/preview/, "") || "/";
  } else if (sts.currentAppUrl.startsWith("/")) {
    sub = sts.currentAppUrl;
  } else {
    try {
      const u = new URL(sts.currentAppUrl);
      sub = (u.pathname === "/" ? "" : u.pathname) + u.search + u.hash;
    } catch {
      sub = "/";
    }
  }

  if (!sub.startsWith("/")) sub = "/" + sub;
  return location.origin + "/preview" + sub;
}

export function openCompanionRoute(path) {
  const target = getExternalAppUrl(path);
  window.open(target, "_blank", "noopener");
}

export function openStudioExternal() {
  const target = getExternalAppUrl();
  window.open(target, "_blank", "noopener");
}

export function setStudioViewport(vp) {
  document.querySelectorAll(".btn-vp[data-vp]").forEach((b) => {
    b.classList.toggle("active", /** @type {HTMLElement} */ (b).dataset.vp === vp);
  });
  const cont = $("studioViewportContainer");
  if (!cont) return;
  cont.style.width = vp;
  cont.classList.toggle("device-frame", vp !== "100%");
}

export function handleStudioChatKey(e) {
  return baseHandleKey(e, sendStudioChatMessage);
}

export function sendStudioChatMessage() {
  const inp = /** @type {HTMLTextAreaElement | null} */ ($("studioChatInput"));
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;
  sendChatMessage("studio");
}



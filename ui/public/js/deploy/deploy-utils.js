// @ts-check
// Histórico, confirmação, modais genéricos e utilitários de formatação.
import { dp } from "./deploy-store.js";
import { renderStats, renderHistory } from "./deploy-render.js";
import { patchScreen } from "../shared/screen-state.js";

const win = typeof window !== "undefined" ? window : globalThis;

win.clearHistory = async function () {
  win.openConfirmModal(
    "Limpar Histórico de Deploys?",
    "Deseja apagar todos os registros de disparos anteriores?",
    async () => {
      try {
        await fetch("/api/deploy/clear-history", { method: "POST" });
        dp.deployHistory = [];
        renderHistory();
        renderStats();
        showToast("Histórico limpo com sucesso", "success");
      } catch (err) {
        showToast("Erro ao limpar histórico", "error");
      }
    }
  );
};

export async function persistConfig() {
  dp.deployState.config = dp.deployConfig;
  let savedInState = false;
  try {
    await patchScreen("deploy", { config: dp.deployConfig });
    savedInState = true;
  } catch {}
  try {
    const res = await fetch("/api/deploy/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: dp.deployConfig }),
    });
    if (!res.ok) throw new Error("Erro ao salvar config no servidor");
  } catch (err) {
    // A reserva do estado de tela mantém a configuração quando o servidor não responde.
    console.warn(savedInState ? "Config mantida no estado da tela:" : "Config não persistida:", err);
  }
}

// Utilitários
win.copyToClipboard = function (text) {
  if (!text) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      () => showToast("URL copiada para a área de transferência!", "success"),
      () => showToast("Não foi possível copiar automaticamente", "error")
    );
  }
};

win.copyCurl = function (url, method) {
  const cmd = `curl -X ${method || 'POST'} "${url}"`;
  win.copyToClipboard(cmd);
};

win.openConfirmModal = function (title, bodyHtml, onConfirm) {
  if (typeof document === "undefined") return;
  const titleEl = document.getElementById("confirmModalTitle");
  const bodyEl = document.getElementById("confirmModalBody");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  dp.pendingConfirmAction = onConfirm;
  openModal("modalConfirm");
};

win.executePendingConfirm = async function () {
  win.closeModal("modalConfirm");
  if (typeof dp.pendingConfirmAction === "function") {
    const action = dp.pendingConfirmAction;
    dp.pendingConfirmAction = null;
    await action();
  }
};

export function openModal(id) {
  if (typeof document === "undefined") return;
  const m = document.getElementById(id);
  if (m) m.classList.add("open");
}

win.closeModal = function (id) {
  if (typeof document === "undefined") return;
  const m = document.getElementById(id);
  if (m) m.classList.remove("open");
};

export function maskUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.searchParams.has("token")) {
      const tok = u.searchParams.get("token") || "";
      if (tok.length > 8) {
        u.searchParams.set("token", tok.slice(0, 4) + "..." + tok.slice(-4));
      }
    }
    return u.toString();
  } catch {
    return url.replace(/([?&]token=)([^&]{4})[^&]+/i, "$1$2...");
  }
}

export function formatTimeAgo(date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  return `há ${Math.floor(hr / 24)}d`;
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(str) {
  if (str == null) return "";
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
  const iconHtml = type === "success" 
    ? '<i class="fa-solid fa-check"></i>' 
    : type === "error" 
      ? '<i class="fa-solid fa-circle-xmark"></i>' 
      : '<i class="fa-solid fa-circle-info"></i>';
  toast.innerHTML = `<span style="font-weight:700; color:${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--accent)'}">${iconHtml}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

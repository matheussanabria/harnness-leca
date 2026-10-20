// @ts-check
// Modal de continuar conversa e reinício da sessão.
import { $, esc } from "../shared/dom.js";
import { state, clearActiveChatState, clearChatDraft } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { hideMiniChatWidget } from "./chat-mini.js";
import { setChatStatus } from "./chat-stream-ui.js";
import { renderChatHistory } from "./chat-render.js";
import { resumeExistingChat } from "./chat-persist.js";
import { clearEngineSessions } from "./chat-session-store.js";

export function openContinueChatModal() {
  const P = state.P;
  if (!P) return;
  const dlg = /** @type {any} */ ($("continueChatDlg"));
  if (!dlg) return;
  $("continueChatTitle").textContent = `Continuar conversa · ${P.slug}`;
  const searchInput = /** @type {HTMLInputElement} */ ($("continueChatSearch"));
  if (searchInput) searchInput.value = "";
  cs.continueChatFilter = "all";
  updateContinueFilterButtons();
  renderContinueChatList();
  dlg.showModal();
  if (searchInput) setTimeout(() => searchInput.focus(), 50);
}

export function setContinueChatFilter(filter) {
  cs.continueChatFilter = filter;
  updateContinueFilterButtons();
  renderContinueChatList();
}

export function updateContinueFilterButtons() {
  document.querySelectorAll("#continueChatFilterGroup .btn-vp").forEach((b) => {
    b.classList.toggle("active", /** @type {HTMLElement} */ (b).dataset.filter === cs.continueChatFilter);
  });
}

export function filterContinueChats() {
  renderContinueChatList();
}

export function renderContinueChatList() {
  const P = state.P;
  const container = $("continueChatList");
  if (!container || !P) return;
  const searchInput = /** @type {HTMLInputElement} */ ($("continueChatSearch"));
  const q = (searchInput?.value || "").trim().toLowerCase();

  let chats = P.chats || [];
  if (cs.continueChatFilter !== "all") {
    chats = chats.filter((c) => c.agent === cs.continueChatFilter);
  }
  if (q) {
    chats = chats.filter((c) => (c.title || "").toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }

  if (!chats.length) {
    container.innerHTML = `<div class="empty" style="padding:40px 10px;text-align:center">Nenhuma conversa encontrada${q ? ' para a busca "' + esc(q) + '"' : ""}.</div>`;
    return;
  }

  container.innerHTML = chats
    .map((c) => {
      const ag =
        c.agent === "gemini"
          ? '<span class="tag" style="color:#7ca5f5;border-color:#7ca5f544"><i class="fa-solid fa-bolt"></i> Gemini</span>'
          : c.agent === "opencode"
          ? '<span class="tag" style="color:#7de2a3;border-color:#7de2a344"><i class="fa-solid fa-code"></i> OpenCode</span>'
          : c.agent === "codex"
          ? '<span class="tag" style="color:#f59e0b;border-color:#f59e0b44"><i class="fa-solid fa-terminal"></i> Codex</span>'
          : c.agent === "ollama"
          ? '<span class="tag" style="color:#e06c75;border-color:#e06c7544"><i class="fa-solid fa-microchip"></i> Ollama Local</span>'
          : '<span class="tag"><i class="fa-solid fa-asterisk"></i> Claude</span>';
      const turnsTxt = c.turns ? `${c.turns} turnos · ` : "";
      const dateTxt = new Date(c.mtime).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
      const title = c.title || c.name.replace(/\.md$/, "");

      return `
      <div class="row" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;cursor:default">
        <div style="flex:1;min-width:0;margin-right:12px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            ${ag}
            <b title="${esc(title)}" style="font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</b>
          </div>
          <div title="${esc(c.name)}" style="font-size:11.5px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${turnsTxt}${dateTxt} · <code>${esc(c.name)}</code>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button type="button" class="btn-send" style="padding:6px 12px;font-size:12px" onclick="resumeExistingChat('${esc(c.name)}', true)" title="Continuar esta conversa no Vibecoding Studio">
            <i class="fa-solid fa-laptop-code"></i> Studio
          </button>
          <button type="button" class="btn-vp" style="padding:6px 12px;font-size:12px" onclick="resumeExistingChat('${esc(c.name)}', false)" title="Continuar no Chat Modal">
            <i class="fa-solid fa-comments"></i> Chat
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

export function resetChatSession() {
  const slug = state.P ? state.P.slug : null;
  state.chatTurns = [];
  state.currentChatFile = null;
  cs.currentChatFile = null;
  cs.currentChatTitle = null;
  clearEngineSessions(slug, null);
  const b1 = /** @type {HTMLButtonElement} */ ($("btnSaveChat"));
  if (b1) b1.disabled = true;
  const b2 = /** @type {HTMLButtonElement} */ ($("btnSaveStudioChat"));
  if (b2) b2.disabled = true;
  setChatStatus("Novo chat iniciado.");
  clearActiveChatState(slug);
  clearChatDraft(slug);
  const inp = /** @type {HTMLInputElement} */ ($("chatInput"));
  if (inp) {
    inp.value = "";
    inp.style.height = "auto";
  }
  hideMiniChatWidget();
  renderChatHistory();
}

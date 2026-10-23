// @ts-check
// Sincronização de conversas e abertura de arquivos do projeto.
import { esc, clean, openDlg } from "../shared/dom.js";
import { renderChat } from "../shared/markdown.js";
import { state, logChatAction, CHAT_ACTIONS } from "../shared/state.js";
import { ps } from "./projects-store.js";
import { load } from "./projects-load.js";

export async function syncProjectChats(engine = "all", fromModal = false) {
  const P = state.P;
  if (ps.isSyncingChats || !P || !P.slug) return;
  ps.isSyncingChats = true;
  const toast = $("syncToast");
  const allBtns = document.querySelectorAll(".btn-sync-action, .btn-sync-chat");
  allBtns.forEach((b) => {
    /** @type {HTMLButtonElement} */ (b).disabled = true;
    b.classList.add("is-syncing");
  });

  const labelMap = { all: "todos os motores", claude: "Claude Code", gemini: "Gemini", opencode: "OpenCode" };
  const targetLabel = labelMap[engine] || engine;

  if (toast) {
    toast.style.display = "inline-flex";
    toast.style.opacity = "1";
    toast.className = "sync-toast info";
    toast.innerHTML = `<span class="sync-rot">🔄</span> Sincronizando ${targetLabel}...`;
  }

  try {
    const res = await fetch(`/api/project/${encodeURIComponent(P.slug)}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();

    // Recarrega o projeto para atualizar a lista de chats e metadados na tela
    await load(P.slug);

    if (toast) {
      toast.style.display = "inline-flex";
      toast.style.opacity = "1";
      const isNew = data.totalNova > 0 || data.totalAtualizada > 0;
      toast.className = `sync-toast ${isNew ? "success" : "info"}`;
      toast.innerHTML = `${isNew ? "✓" : "ℹ"} ${esc(data.mensagem)}`;
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
          toast.style.display = "none";
          toast.style.opacity = "1";
        }, 400);
      }, 5000);
    }
  } catch (err) {
    if (toast) {
      toast.style.display = "inline-flex";
      toast.style.opacity = "1";
      toast.className = "sync-toast error";
      toast.innerHTML = `⚠️ Falha ao sincronizar: ${esc(err.message || String(err))}`;
      setTimeout(() => {
        toast.style.display = "none";
      }, 5000);
    }
  } finally {
    ps.isSyncingChats = false;
    allBtns.forEach((b) => {
      /** @type {HTMLButtonElement} */ (b).disabled = false;
      b.classList.remove("is-syncing");
    });
  }
}

export const showIns = () =>
  openDlg("Instruções", "## Globais\n" + clean(state.S.global.instructions) + "\n\n## Do projeto\n" + clean(state.P.instructions));

export const showMem = () =>
  openDlg("Memória", "## Global\n" + clean(state.S.global.memory) + "\n\n## Do projeto\n" + clean(state.P.memory));

export async function openFile(dir, name) {
  const P = state.P;
  if (!P) return;
  const r = await (await fetch("/api/file?path=" + encodeURIComponent(`${P.slug}/${dir}/${name}`))).json();
  const rawContent = r.content || "";
  const text = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  if (dir === "chats") {
    await logChatAction(CHAT_ACTIONS.OPEN_CHAT, name);
    const c = P.chats.find((x) => x.name === name);
    const actionsHtml = `
      <div style="display:flex;gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center">
        <button type="button" class="btn-send" style="padding:6px 14px;font-size:12.5px" onclick="resumeExistingChat('${esc(name)}', true)">
          🚀 Continuar no Vibecoding Studio
        </button>
        <button type="button" class="btn-chat-action" style="padding:6px 14px;font-size:12.5px" onclick="resumeExistingChat('${esc(name)}', false)">
          💬 Continuar no Chat
        </button>
        <span style="font-size:11.5px;color:var(--mute);margin-left:auto">Carrega histórico e sessão para continuar de onde parou</span>
      </div>
    `;
    openDlg((c && c.title) || name, "", actionsHtml + renderChat(text));
  } else {
    openDlg(name, text);
  }
}

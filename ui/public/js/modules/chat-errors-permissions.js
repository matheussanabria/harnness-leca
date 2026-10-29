// @ts-check
// Cartões de erro e pedidos de permissão do motor no chat.
import { $, esc, showToast, openDlg } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ENGINES } from "./chat-store.js";
import { setChatStatus } from "./chat-stream-ui.js";
import { renderChatHistory } from "./chat-render.js";

// ---------- Erros do chat (cartão com título, explicação, dica e detalhe técnico) ----------
// O servidor manda { type: "error", error, code, title, hint, detail, retryable } (tools/lib/engines/errors.js).
// Erros que nascem aqui no navegador (conexão caída, pedido recusado) usam o mesmo formato.
export function errorInfoFrom(data) {
  return { code: data.code || "unknown", title: data.title || "Erro", message: data.error || data.message || "Erro desconhecido.", hint: data.hint, detail: data.detail, retryable: !!data.retryable };
}

export function clientErrorInfo(err) {
  if (err && err.info) return err.info; // erro do servidor já traduzido (título, dica, detalhe)
  const m = String((err && err.message) || err || "");
  if (/failed to fetch|networkerror|load failed|network request failed|^network error$|err_incomplete_chunked|terminated/i.test(m)) {
    return {
      code: "client_network",
      title: "Conexão interrompida com o servidor",
      message: "A interface perdeu a conexão HTTP durante o processamento da resposta.",
      hint: "Isso acontece se a resposta demorou excessivamente sem enviar novos dados, ou se o processo de fundo do motor foi reiniciado. Tente um pedido mais conciso ou outro modelo.",
      retryable: true,
      detail: m,
    };
  }
  if (err && err.http) {
    return { code: "refused", title: "O servidor recusou o pedido", message: m, retryable: err.http === 429 };
  }
  return { code: "client", title: "Erro na resposta do modelo", message: m, hint: "Confira o status do motor no terminal ou tente novamente com instruções mais simples." };
}

export function errorHtml(e) {
  const hint = e.hint ? `<div class="err-hint"><i class="fa-regular fa-lightbulb"></i> ${esc(e.hint).replace(/`([^`]+)`/g, "<code>$1</code>")}</div>` : "";
  const detail = e.detail ? `<details class="err-detail"><summary>Detalhes técnicos</summary><pre>${esc(e.detail)}</pre></details>` : "";
  return `<div class="err-card${e.code === "unknown" ? " unknown" : ""}">
    <div class="err-title"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(e.title || "Erro")}${e.retryable ? ' <span class="err-tag">pode tentar de novo</span>' : ""}</div>
    <div class="err-msg">${esc(e.message)}</div>${hint}${detail}
  </div>`;
}

// ---------- Pedidos de permissão do motor (cartões no chat) ----------
// O servidor manda { type: "permission" } quando o Claude precisa de licença e { type: "permission_resolved" } quando
// o pedido termina (resposta, regra automática, tempo esgotado ou conversa encerrada). O cartão guarda o estado.
export function applyPermissionEvent(holder, data) {
  if (data.type === "permission") {
    holder.permissions = holder.permissions || [];
    holder.permissions.push({ ...data, state: data.auto ? "auto" : "pending" });
    if (!data.auto) setChatStatus("Aguardando a sua permissão...");
  } else if (data.type === "permission_resolved") {
    const p = (holder.permissions || []).find((x) => x.id === data.id);
    if (!p) return;
    p.scope = data.scope;
    p.state = data.auto && data.scope === "rule" ? "auto" : data.decision === "allow" ? "allowed" : data.scope === "timeout" ? "expired" : "denied";
    if (!holder.permissions.some((x) => x.state === "pending")) setChatStatus("Recebendo resposta...");
  }
}

export const SCOPE_LABEL = {
  once: () => "Permitir uma vez",
  chat: (p) => (p.kind === "file" ? "Permitir a pasta nesta conversa" : "Permitir nesta conversa"),
  project: (p) => (p.kind === "file" ? "Permitir a pasta sempre neste projeto" : "Permitir sempre neste projeto"),
};

export function permissionsHtml(list, live) {
  if (!list || !list.length) return "";
  return list
    .map((p) => {
      const what = `<code>${esc(p.summary)}</code>`;
      if (p.state === "auto") return `<div class="perm-card done"><i class="fa-solid fa-check"></i> Permitido automaticamente por regra · ${what}</div>`;
      if (p.state === "allowed") return `<div class="perm-card done"><i class="fa-solid fa-check"></i> Você permitiu${p.scope && p.scope !== "once" ? ` (${p.scope === "project" ? "sempre neste projeto" : "nesta conversa"})` : ""} · ${what}</div>`;
      if (p.state === "denied") return `<div class="perm-card denied"><i class="fa-solid fa-xmark"></i> Você negou · ${what}</div>`;
      if (p.state === "expired") return `<div class="perm-card denied"><i class="fa-solid fa-clock"></i> Sem resposta a tempo, negado · ${what}</div>`;
      if (p.state === "sending") return `<div class="perm-card done">… Enviando a sua resposta · ${what}</div>`;
      if (!live) return `<div class="perm-card denied"><i class="fa-solid fa-clock"></i> Pedido encerrado sem resposta · ${what}</div>`;
      const dirLine = p.kind === "file" && p.dir ? `<div class="perm-meta">Pasta que seria liberada: <code>${esc(p.dir)}</code>${p.access === "write" ? " (leitura e escrita)" : " (só leitura)"}</div>` : "";
      const warn = p.sensitive ? `<div class="perm-warn"><i class="fa-solid fa-triangle-exclamation"></i> Caminho sensível (segredos/credenciais): só dá para permitir uma vez.</div>` : "";
      const btns = p.scopes
        .map((sc, i) => `<button type="button" class="perm-btn${i === 0 ? " primary" : ""}" onclick="answerPermission('${esc(p.id)}','allow','${sc}')">${esc(SCOPE_LABEL[sc](p))}</button>`)
        .join("");
      return `<div class="perm-card pending" data-perm="${esc(p.id)}">
        <div class="perm-title"><i class="fa-solid fa-shield-halved"></i> ${esc(ENGINES.claude.name)} pede permissão</div>
        <div class="perm-what">${what}</div>${dirLine}${warn}
        <div class="perm-actions">${btns}<button type="button" class="perm-btn deny" onclick="answerPermission('${esc(p.id)}','deny')">Negar</button></div>
      </div>`;
    })
    .join("");
}

export function findPermission(id) {
  for (const t of state.chatTurns) {
    const holders = t.role === "comparison" ? Object.values(t.responses || {}) : [t];
    for (const h of holders) {
      const p = (h.permissions || []).find((x) => x.id === id);
      if (p) return p;
    }
  }
  return null;
}

export async function answerPermission(id, decision, scope) {
  const p = findPermission(id);
  if (!p || p.state !== "pending") return;
  p.state = "sending";
  renderChatHistory(true);
  try {
    const res = await fetch("/api/permissions/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, scope }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
    // O estado final chega pelo stream (permission_resolved); isto cobre o caso de o evento já ter passado.
    if (p.state === "sending") {
      p.state = decision === "allow" ? "allowed" : "denied";
      p.scope = scope;
    }
  } catch (err) {
    p.state = "expired";
    showToast(`Não foi possível enviar a resposta: ${err.message}`);
  }
  renderChatHistory(true);
}

export async function openPermissionsDialog() {
  const P = state.P;
  if (!P) return;
  try {
    const r = await (await fetch(`/api/project/${encodeURIComponent(P.slug)}/permissions`)).json();
    const allow = r.allow || [];
    const rows = allow.length
      ? allow
          .map((rule, i) => {
            const what = rule.kind === "dir" ? `Pasta <code>${esc(rule.dir)}</code> · ${rule.access === "write" ? "leitura e escrita" : "só leitura"}` : `Ferramenta <code>${esc(rule.tool)}</code>`;
            return `<div class="perm-rule"><span>${what}</span><button type="button" class="perm-btn deny" onclick="removePermissionRule(${i})">Remover</button></div>`;
          })
          .join("")
      : '<p class="empty">Nenhuma permissão salva neste projeto. Elas aparecem aqui quando você escolhe "sempre neste projeto" num pedido do chat.</p>';
    openDlg(`Permissões salvas · ${P.slug}`, "", rows);
  } catch (err) {
    showToast(`Falha ao carregar as permissões: ${err.message}`);
  }
}

export async function removePermissionRule(index) {
  const P = state.P;
  if (!P) return;
  const res = await fetch(`/api/project/${encodeURIComponent(P.slug)}/permissions/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index }),
  });
  if (res.ok) openPermissionsDialog();
  else showToast("Não foi possível remover a permissão.");
}

// @ts-check
// Renderização do histórico do chat.
import { $, esc } from "../shared/dom.js";
import { md } from "../shared/markdown.js";
import { state } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { scheduleDebouncedChatSave } from "./chat-mini.js";
import { cancelEngineStream } from "./chat-stream-ui.js";
import { errorHtml, permissionsHtml } from "./chat-errors-permissions.js";
import { isChatStreamingFor } from "./chat-execution-store.js";
import { handleChatHistoryScroll } from "./chat-ui-interaction.js";

function hiaScriptCard(turn, bodyHtml) {
  const tokens = Number(turn.tokensSaved) || 0;
  const isLocal = turn.hiaRoute === "local_llm";
  const title = isLocal
    ? `Inferência Local — ${esc(turn.model || "Ollama")}`
    : `Automação Local — ${esc(turn.hiaTool || "script")}`;
  return `<div class="hia-script-card">
    <div class="hia-script-card__header">
      <i class="fa-solid ${isLocal ? "fa-microchip" : "fa-bolt"}"></i>
      <span>${title}</span>
      <span class="hia-script-card__badge">${tokens} tokens</span>
    </div>
    <div class="hia-script-card__body">${bodyHtml}</div>
  </div>`;
}

export function renderChatHistory(keepScroll = false) {
  const boxes = [$("chatHistory"), $("studioChatHistory"), $("miniChatHistory")].filter(Boolean);
  if (!boxes.length) return;
  const activeChatStreaming = Boolean(state.P && isChatStreamingFor(state.P.slug, cs.currentChatFile));

  if (!state.chatTurns.length) {
    const emptyHtml = `
      <div class="chat-empty-hero">
        <div class="chat-empty-icon"><i class="fa-regular fa-comments"></i></div>
        <h2 class="chat-empty-title">Como posso ajudar você no projeto?</h2>
        <p class="chat-empty-sub">Instruções, memórias e agentes DAI carregados e prontos para desenvolvimento.</p>
        <div class="chat-quick-suggestions">
          <button type="button" class="quick-suggest-btn" onclick="applySuggestedPrompt('Refatore o dashboard mantendo a arquitetura atual e os componentes existentes.')">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Refatore o dashboard...
          </button>
          <button type="button" class="quick-suggest-btn" onclick="applySuggestedPrompt('Analise as regras e memórias do projeto e sugira melhorias de código.')">
            <i class="fa-solid fa-book-open"></i> Analise regras e memórias...
          </button>
          <button type="button" class="quick-suggest-btn" onclick="applySuggestedPrompt('Escreva cenários BDD em Gherkin para o fluxo principal desta funcionalidade.')">
            <i class="fa-solid fa-vial"></i> Escreva cenários BDD...
          </button>
        </div>
      </div>
    `;
    boxes.forEach((b) => {
      b.innerHTML = emptyHtml;
    });
    return;
  }

  const effortMap = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra High", max: "Max" };

  const html = state.chatTurns
    .map((t, idx) => {
      if (t.role === "user") {
        return `<div class="msg user"><div class="bubble"><p>${esc(t.text).replace(/\n/g, "<br>")}</p></div></div>`;
      }

      if (t.role === "comparison") {
        const cols = t.engines
          .map((eng) => {
            const resp = t.responses[eng] || { text: "", thinking: "", streaming: false, phase: "done" };
            const meta = cs.enginesMeta[eng] || { name: eng, icon: '<i class="fa-solid fa-robot"></i>' };
            const isStreaming = resp.streaming;
            const phase = resp.phase || (isStreaming ? (resp.text ? "answering" : resp.thinking ? "thinking" : "connecting") : "done");

            let statusBadge = "";
            let cancelBtn = "";
            const elapsedSec = (resp.elapsedMs ? resp.elapsedMs : Date.now() - resp.startTime) / 1000;
            const timeBadge = `<span class="col-timer"><i class="fa-solid fa-stopwatch"></i> ${elapsedSec.toFixed(1)}s</span>`;

            if (isStreaming) {
              cancelBtn = `<button type="button" class="btn-cancel-single" title="Interromper este motor" onclick="cancelEngineStream('${eng}')"><i class="fa-solid fa-square"></i> Parar</button>`;
              if (phase === "thinking") {
                statusBadge = `<span class="live-pill thinking"><i class="fa-solid fa-brain"></i> Pensando...</span>`;
              } else if (phase === "connecting") {
                statusBadge = `<span class="live-pill connecting"><i class="fa-solid fa-spinner fa-spin"></i> Conectando...</span>`;
              } else {
                statusBadge = `<span class="live-pill answering"><span class="live-pulse"></span> Respondendo...</span>`;
              }
            }

            const isThinkOpen = isStreaming && !resp.text ? " open" : "";
            const thinkingHtml = resp.thinking
              ? `<details class="chat-thinking"${isThinkOpen}><summary><span style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-brain"></i> Raciocínio interno ${isStreaming && phase === "thinking" ? '<span class="thinking-stream-badge">gerando pensamento...</span>' : ""}</span></summary><div class="think-content">${esc(resp.thinking)}</div></details>`
              : "";

            let bodyHtml = "";
            if (resp.error) {
              const isUserAbort = /Interrompido/i.test(resp.error);
              bodyHtml = isUserAbort || !resp.errorInfo
                ? `<p style="color:${isUserAbort ? "var(--mute)" : "#ef4444"};font-size:12px;padding:8px 10px;background:${isUserAbort ? "var(--bg)" : "rgba(239,68,68,0.1)"};border-radius:6px;border:1px solid ${isUserAbort ? "var(--line)" : "rgba(239,68,68,0.2)"}">${isUserAbort ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'} <b>${isUserAbort ? "Parado:" : "Erro:"}</b> ${esc(resp.error)}</p>`
                : (resp.text ? md(resp.text) : "") + errorHtml(resp.errorInfo);
            } else if (resp.text) {
              bodyHtml = md(resp.text);
            } else if (isStreaming) {
              if (phase === "connecting" && !resp.thinking) {
                bodyHtml = `
              <div class="thinking-placeholder">
                <div class="thinking-pulse-dot"></div>
                <div>
                  <div style="font-weight:600;font-size:12px;color:var(--text)">Iniciando ${esc(meta.name)}...</div>
                  <div style="font-size:11px;color:var(--mute);margin-top:2px">Carregando instruções e memórias do projeto</div>
                </div>
              </div>
            `;
              } else if (!resp.thinking) {
                bodyHtml = '<p style="color:var(--mute);font-style:italic">Aguardando resposta...</p>';
              }
            } else {
              bodyHtml = '<p style="color:var(--mute)">Sem resposta gerada.</p>';
            }

            const finalBody = resp.hiaRoute ? hiaScriptCard(resp, bodyHtml) : bodyHtml;
            const cursorHtml = isStreaming ? '<span class="stream-cursor">▌</span>' : "";
            const effortBadge = resp.effort
              ? `<span style="font-size:10px;border:1px solid var(--line);padding:1px 5px;border-radius:4px;opacity:0.8">${esc(effortMap[resp.effort] || resp.effort)}</span>`
              : "";
            const modelBadge = resp.model ? `<span style="font-size:11px;opacity:0.75;font-weight:normal">${esc(resp.model)}</span>` : "";

            return `
          <div class="compare-col ${eng}">
            <div class="compare-col-header">
              <div class="who">${esc(meta.icon)} ${esc(meta.name)}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
                ${modelBadge}
                ${effortBadge}
                ${statusBadge}
                ${timeBadge}
                ${cancelBtn}
              </div>
            </div>
            <div class="compare-col-body">
              ${permissionsHtml(resp.permissions, isStreaming)}
              ${thinkingHtml}
              ${finalBody}
              ${cursorHtml}
            </div>
          </div>
        `;
          })
          .join("");

        return `
        <div class="msg comparison" style="width:100%">
          <div class="compare-grid cols-${Math.min(t.engines.length, 3)}">
            ${cols}
          </div>
        </div>
      `;
      }

      const eng = cs.enginesMeta[t.engine || cs.currentEngine] || { name: "Assistente", icon: '<i class="fa-solid fa-robot"></i>' };
      const engClass = t.engine || cs.currentEngine;
      const isLastStreaming = activeChatStreaming && idx === state.chatTurns.length - 1;
      const isThinkOpen = isLastStreaming && !t.text ? " open" : "";
      const thinkingHtml = t.thinking
        ? `<details class="chat-thinking"${isThinkOpen}><summary><span style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-brain"></i> Raciocínio interno ${isLastStreaming && t.phase === "thinking" ? '<span class="thinking-stream-badge">gerando pensamento...</span>' : ""}</span></summary><div class="think-content">${esc(t.thinking)}</div></details>`
        : "";

      let bodyHtml = "";
      if (t.errorInfo) {
        bodyHtml = (t.text ? md(t.text) : "") + errorHtml(t.errorInfo);
      } else if (t.text) {
        bodyHtml = md(t.text);
      } else if (isLastStreaming) {
        if (!t.thinking) {
          bodyHtml = `
          <div class="thinking-placeholder">
            <div class="thinking-pulse-dot"></div>
            <div>
              <div style="font-weight:600;font-size:12px;color:var(--text)">Iniciando ${esc(eng.name)}...</div>
              <div style="font-size:11px;color:var(--mute);margin-top:2px">Injetando instruções e memória do projeto</div>
            </div>
          </div>
        `;
        }
      } else {
        bodyHtml = '<p class="empty">Sem resposta</p>';
      }

      const finalBody = t.hiaRoute ? hiaScriptCard(t, bodyHtml) : bodyHtml;
      const cursorHtml = isLastStreaming ? '<span class="stream-cursor">▌</span>' : "";
      const modelLabel = t.model ? ` · <span style="opacity:0.75;font-weight:normal">${esc(t.model)}</span>` : "";
      const effortLabel = t.effort
        ? ` <span style="font-size:10px;opacity:0.65;border:1px solid var(--line);padding:1px 5px;border-radius:4px">${esc(effortMap[t.effort] || t.effort)}</span>`
        : "";
      return `<div class="msg ${engClass}"><div class="who">${esc(eng.name || "Assistente")}${modelLabel}${effortLabel}</div><div class="bubble">${permissionsHtml(t.permissions, isLastStreaming)}${thinkingHtml}${finalBody}${cursorHtml}</div></div>`;
    })
    .join("");

  boxes.forEach((box) => {
    const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const isInitial = box.scrollTop === 0;
    box.innerHTML = html;
    if (!keepScroll && (wasNearBottom || isInitial)) {
      box.scrollTop = box.scrollHeight;
    }
    handleChatHistoryScroll(box);
  });
  scheduleDebouncedChatSave();
}

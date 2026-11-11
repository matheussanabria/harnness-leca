// @ts-check
// Chat integration for /workflows and /workflow: intercepts the command, shows cards and advances gates.
import { state, saveActiveChatState } from "../shared/state.js";
import { showToast } from "../shared/dom.js";
import { renderChatHistory } from "./chat-render.js";
import { workflowListHtml, workflowErrorHtml, workflowCardHtml } from "./chat-workflow-command-view.js";
import { installWorkflowSuggest } from "./chat-workflow-suggest.js";

const COMMAND_RE = /^\/workflows?(\s|$)/i;

/** @param {string} text */
export function isWorkflowCommandText(text) {
  return COMMAND_RE.test(String(text || "").trim());
}

/** @param {string} url @param {any} body */
async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** @param {any} turn */
function pushAssistant(turn) {
  state.chatTurns.push({ role: "assistant", engine: "workflow", text: "", ...turn });
  saveActiveChatState();
  renderChatHistory();
}

/**
 * Handles the command; the user turn is already in the history.
 * @param {string} slug @param {string} text
 */
export async function runChatWorkflowCommand(slug, text) {
  let out;
  try {
    out = await postJson(`/api/project/${encodeURIComponent(slug)}/workflow-command`, { text, actor: "chat" });
  } catch {
    const msg = "Falha de rede ao executar o comando.";
    return pushAssistant({ text: msg, workflowHtml: workflowErrorHtml(msg) });
  }
  const d = out.data;
  if (!out.ok) return pushAssistant({ text: d.error || "Erro", workflowHtml: workflowErrorHtml(d.error || "Falha no comando.") });
  if (d.kind === "list") return pushAssistant({ text: "Workflows do catálogo", workflowHtml: workflowListHtml(d.workflows) });
  return pushAssistant({ text: `Workflow ${d.card.workflowId} iniciado`, workflowCard: d.card, workflowHtml: workflowCardHtml(d.card) });
}

/** Approves when gated, advances one stage and refreshes the card. @param {HTMLElement} btn */
async function onCardAction(btn) {
  const { wfAction, wfExec, wfStage } = btn.dataset;
  btn.setAttribute("disabled", "true");
  const base = `/api/orchestration/workflow-runs/${encodeURIComponent(wfExec || "")}`;
  const fail = (/** @type {any} */ data, fallback) => { btn.removeAttribute("disabled"); showToast(data.error || fallback); };
  if (wfAction === "cancel") {
    const res = await postJson(`${base}/cancel`, { reason: "Cancelado pelo chat." });
    if (!res.ok) return fail(res.data, "Não foi possível cancelar.");
    const t = state.chatTurns.find((x) => x.workflowCard?.executionId === wfExec);
    if (!t) return;
    t.workflowCard = { ...t.workflowCard, status: "cancelled", gate: false, actions: [] };
    t.workflowHtml = workflowCardHtml(t.workflowCard);
    saveActiveChatState();
    return renderChatHistory(true);
  }
  if (wfAction === "approve") {
    const ap = await postJson(`${base}/approve`, { stageId: wfStage, decision: "approved", actor: "chat" });
    if (!ap.ok) return fail(ap.data, "Aprovação falhou.");
  }
  const adv = await postJson(`${base}/advance`, { stageId: wfStage, status: "completed", note: "Avançado pelo chat." });
  if (!adv.ok) return fail(adv.data, "Não foi possível avançar.");
  const run = adv.data.run;
  const cur = run.currentStage;
  const turn = state.chatTurns.find((t) => t.workflowCard?.executionId === wfExec);
  if (!turn) return;
  turn.workflowCard = {
    ...turn.workflowCard,
    status: run.status,
    stageId: cur ? cur.id : "",
    stageLabel: cur ? cur.label : "",
    gate: Boolean(cur?.requiresApproval),
    actions: cur ? [{ id: cur.requiresApproval ? "approve" : "advance", label: cur.requiresApproval ? "Aprovar e avançar" : "Avançar etapa" }, { id: "cancel", label: "Cancelar execução" }] : [],
  };
  turn.workflowHtml = workflowCardHtml(turn.workflowCard);
  saveActiveChatState();
  renderChatHistory(true);
}

let installed = false;
export function installWorkflowCommandUi() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("click", (ev) => {
    const btn = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (ev.target)?.closest?.("[data-wf-action]"));
    if (btn) onCardAction(btn);
  });
  installWorkflowSuggest();
}
installWorkflowCommandUi();

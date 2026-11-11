// @ts-check
// Chat integration for /workflows and /workflow: intercepts the command, shows cards and advances gates.
import { state, saveActiveChatState } from "../shared/state.js";
import { $, showToast } from "../shared/dom.js";
import { CHAT_PRESENTATIONS } from "./chat-presentations.js";
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

/** @param {string} url */
async function getJson(url) {
  const res = await fetch(url);
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
  if (wfAction === "run") return runStageInChat(btn, wfExec);
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
  const turn = state.chatTurns.find((t) => t.workflowCard?.executionId === wfExec);
  if (!turn) return;
  // The server builds the card (actions + prompt of the new stage); a finished run has no stage left.
  const run = adv.data.run;
  const fresh = run.currentStage ? await getJson(cardUrl(wfExec)) : null;
  turn.workflowCard = fresh?.ok
    ? fresh.data.card
    : { ...turn.workflowCard, status: run.status, stageId: "", stageLabel: "", gate: false, stagePrompt: "", actions: [] };
  turn.workflowHtml = workflowCardHtml(turn.workflowCard);
  saveActiveChatState();
  renderChatHistory(true);
}

function cardUrl(/** @type {string|undefined} */ executionId) {
  return `/api/project/${encodeURIComponent(state.P?.slug || "")}/workflow-card/${encodeURIComponent(executionId || "")}`;
}

/** Injects the stage prompt into the visible chat composer and sends it through the normal chat path. */
async function runStageInChat(/** @type {HTMLElement} */ btn, /** @type {string|undefined} */ wfExec) {
  const turn = state.chatTurns.find((t) => t.workflowCard?.executionId === wfExec);
  const prompt = turn?.workflowCard?.stagePrompt;
  if (!prompt) return showToast("Esta etapa não tem prompt disponível. Inicie o workflow de novo.");
  const target = Object.entries(CHAT_PRESENTATIONS).find(([, p]) => /** @type {HTMLElement|null} */ ($(p.input))?.offsetParent);
  const [name, pres] = target || ["main", CHAT_PRESENTATIONS.main];
  const input = /** @type {HTMLTextAreaElement|null} */ ($(pres.input));
  if (!input) return showToast("Campo de mensagem não encontrado.");
  input.value = prompt;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  btn.setAttribute("disabled", "true");
  try {
    const { sendChatMessage } = await import("./chat-send.js");
    await sendChatMessage(name);
  } finally {
    btn.removeAttribute("disabled");
  }
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

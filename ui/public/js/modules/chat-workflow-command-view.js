// @ts-check
// Pure renderers for the /workflow chat command: list of workflows, error and stage card.
import { esc } from "../shared/dom.js";

/** @param {any[]} workflows */
export function workflowListHtml(workflows) {
  const items = (workflows || [])
    .map((wf) => {
      const stages = (wf.stages || []).map((s) => `<li>${s.requiresApproval ? '<i class="fa-solid fa-lock"></i> ' : ""}${esc(s.label)}</li>`).join("");
      return `<div class="wf-cmd-item"><div class="wf-cmd-title"><i class="fa-solid fa-diagram-project"></i> <code>${esc(wf.id)}</code> ${esc(wf.label)}</div><div class="wf-cmd-desc">${esc(wf.description)}</div><ol class="wf-cmd-stages">${stages}</ol></div>`;
    })
    .join("");
  return `<div class="wf-cmd-list">${items}</div>`;
}

/** @param {string} message */
export function workflowErrorHtml(message) {
  return `<div class="wf-cmd-card error"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(message)}</div>`;
}

/** @param {any} card */
export function workflowCardHtml(card) {
  if (!card) return "";
  const done = card.status === "completed";
  const icon = done ? "fa-circle-check" : card.gate ? "fa-lock" : "fa-forward";
  const stage = done ? "Concluído" : card.stageLabel || card.stageId;
  const seed = card.seed ? `<div class="wf-cmd-desc"><i class="fa-regular fa-lightbulb"></i> ${esc(card.seed)}</div>` : "";
  const story = card.storyKey ? ` <span class="wf-cmd-tag">${esc(card.storyKey)}</span>` : "";
  const gate = card.gate ? `<div class="wf-cmd-gate">Gate: aguardando aprovação desta etapa.</div>` : "";
  const buttons = (card.actions || [])
    .map((a) => `<button type="button" class="perm-btn primary" data-wf-action="${esc(a.id)}" data-wf-exec="${esc(card.executionId)}" data-wf-stage="${esc(card.stageId)}"><i class="fa-solid fa-forward-step"></i> ${esc(a.label)}</button>`)
    .join("");
  return `<div class="wf-cmd-card"><div class="wf-cmd-title"><i class="fa-solid ${icon}"></i> <code>${esc(card.workflowId)}</code>${story}</div><div>Etapa atual: <b>${esc(stage)}</b></div>${seed}${gate}<div class="perm-actions">${buttons}</div></div>`;
}

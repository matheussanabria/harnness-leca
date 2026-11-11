// @ts-check
// Pure renderers for the /workflow chat command: list of workflows, error and stage card.
import { esc } from "../shared/dom.js";

const ACTION_ICONS = Object.freeze({ run: "fa-play", advance: "fa-forward-step", approve: "fa-check", cancel: "fa-xmark" });

/** @param {any[]} workflows */
export function workflowListHtml(workflows) {
  const items = (workflows || [])
    .map((wf) => {
      const stages = (wf.stages || [])
        .map((s) => s.dispensed
          ? `<li class="wf-cmd-dispensed" title="${esc(s.dispensed)}"><i class="fa-regular fa-circle-xmark"></i> ${esc(s.label)} <small>(dispensada)</small></li>`
          : `<li>${s.requiresApproval ? '<i class="fa-solid fa-lock"></i> ' : ""}${esc(s.label)}</li>`)
        .join("");
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
  const cancelled = card.status === "cancelled";
  const icon = cancelled ? "fa-ban" : done ? "fa-circle-check" : card.gate ? "fa-lock" : "fa-forward";
  const stage = cancelled ? "Cancelado" : done ? "Concluído" : card.stageLabel || card.stageId;
  const seed = card.seed ? `<div class="wf-cmd-desc"><i class="fa-regular fa-lightbulb"></i> ${esc(card.seed)}</div>` : "";
  const story = card.storyKey ? ` <span class="wf-cmd-tag">${esc(card.storyKey)}</span>` : "";
  const gate = card.gate && !cancelled ? `<div class="wf-cmd-gate">Gate: aguardando aprovação desta etapa.</div>` : "";
  const executed = card.executed && !cancelled && !done ? `<div class="wf-cmd-desc"><i class="fa-solid fa-check"></i> Etapa executada. Revise o resultado e conclua para avançar.</div>` : "";
  const live = !cancelled && !done;
  const dossierLine = card.dossier && live ? `<div class="wf-cmd-desc"><i class="fa-regular fa-folder-open"></i> ${esc(card.dossier)}</div>` : "";
  const out = card.output;
  const missing = card.executed && live && out && out.file && !out.exists
    ? `<div class="wf-cmd-gate"><i class="fa-solid fa-triangle-exclamation"></i> O arquivo da etapa (${esc(out.path || out.file)}) ainda não existe ou está vazio. Você pode concluir mesmo assim.</div>`
    : "";
  const buttons = (card.actions || [])
    .map((a) => `<button type="button" class="perm-btn${a.id === "run" ? " primary" : ""}" data-wf-action="${esc(a.id)}" data-wf-exec="${esc(card.executionId)}" data-wf-stage="${esc(card.stageId)}"><i class="fa-solid ${ACTION_ICONS[a.id] || "fa-forward-step"}"></i> ${esc(a.label)}</button>`)
    .join("");
  return `<div class="wf-cmd-card"><div class="wf-cmd-title"><i class="fa-solid ${icon}"></i> <code>${esc(card.workflowId)}</code>${story}</div><div>Etapa atual: <b>${esc(stage)}</b></div>${seed}${dossierLine}${gate}${executed}${missing}<div class="perm-actions">${buttons}</div></div>`;
}

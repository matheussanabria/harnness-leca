// @ts-check
// Motores, agentes/fluxos DAI, modelo, esforço e modo comparação.
import { $, esc, autoGrow } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { updateMobileChatHeader } from "./mobile-chat.js";
import { cs } from "./chat-store.js";
import { chatPresentation } from "./chat-presentations.js";
import { getEngineSession } from "./chat-session-store.js";

export async function initEngines() {
  try {
    cs.enginesMeta = await (await fetch("/api/engines")).json();
    state.enginesInfo = cs.enginesMeta;
    updateEngineAuthBadge();
  } catch {}
}

export async function initDai() {
  try {
    cs.daiData = await (await fetch("/api/dai")).json();
    state.daiData = cs.daiData;
    renderDaiSelectors();
  } catch {}
}

export function renderDaiSelectors() {
  const agents = cs.daiData.agents || [];
  const optionsHtml =
    '<option value="">Assistente Geral</option>' +
    agents.map((a) => {
      const title = (a.title || a.name || "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
      return `<option value="${esc(a.id)}" ${a.id === cs.activeDaiAgent ? "selected" : ""}>${esc(title)}</option>`;
    }).join("");

  const selModal = /** @type {HTMLSelectElement} */ ($("modalDaiSelect"));
  if (selModal) selModal.innerHTML = optionsHtml;
  const selStudio = /** @type {HTMLSelectElement} */ ($("studioDaiSelect"));
  if (selStudio) selStudio.innerHTML = optionsHtml;

  const wfs = cs.daiData.workflows || [];
  const chipsHtml = wfs.map((w) => `<button type="button" class="dai-chip" onclick="applyDaiWorkflow('${esc(w.id)}')">${esc(w.label)}</button>`).join("");
  const chipsModal = $("modalDaiChips");
  if (chipsModal) chipsModal.innerHTML = chipsHtml;
  const chipsStudio = $("studioDaiChips");
  if (chipsStudio) chipsStudio.innerHTML = chipsHtml;
}

export function onDaiAgentChange(val) {
  cs.activeDaiAgent = val || "";
  const selModal = /** @type {HTMLSelectElement} */ ($("modalDaiSelect"));
  if (selModal) selModal.value = cs.activeDaiAgent;
  const selStudio = /** @type {HTMLSelectElement} */ ($("studioDaiSelect"));
  if (selStudio) selStudio.value = cs.activeDaiAgent;
}

export function applyDaiWorkflow(wfId, presentation = state.isStudioMode ? "studio" : "main") {
  const wfs = cs.daiData.workflows || [];
  const wf = wfs.find((w) => w.id === wfId);
  if (!wf) return;
  const target = /** @type {HTMLInputElement} */ ($(chatPresentation(presentation).input));
  if (target) {
    target.value = wf.prompt;
    target.focus();
    autoGrow(target);
  }
}

export function updateEngineControls() {
  const eng = cs.enginesMeta[cs.currentEngine];
  if (!eng) return;

  const sel = $("chatModelSelect");
  const selStudio = $("studioModelSelect");
  const models = eng.models || [];
  const currentModel = cs.engineSettings[cs.currentEngine].model || eng.defaultModel || (models[0]?.id || "");
  cs.engineSettings[cs.currentEngine].model = currentModel;
  const optsHtml = models
    .map((m) => `<option value="${esc(m.id)}" ${m.id === currentModel ? "selected" : ""}>${esc(m.name)}${m.desc ? " (" + esc(m.desc) + ")" : ""}</option>`)
    .join("");
  if (sel) sel.innerHTML = optsHtml;
  if (selStudio) selStudio.innerHTML = optsHtml;

  const levels = eng.effortLevels || [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
  ];
  let currentEffort = cs.engineSettings[cs.currentEngine].effort;
  if (!levels.some((l) => l.id === currentEffort)) {
    currentEffort = eng.defaultEffort || levels[0]?.id || "medium";
    cs.engineSettings[cs.currentEngine].effort = currentEffort;
  }

  const effortContainer = $("effortToggle");
  if (effortContainer) {
    effortContainer.innerHTML = levels
      .map(
        (l) =>
          `<button type="button" class="effort-btn ${l.id === currentEffort ? "active" : ""}" data-effort="${esc(l.id)}" onclick="setEffort('${esc(l.id)}')">${esc(l.label)}</button>`
      )
      .join("");
  }
  const effortStudio = $("studioEffortContainer");
  if (effortStudio) {
    effortStudio.innerHTML = levels
      .map(
        (l) =>
          `<button type="button" class="effort-btn ${l.id === currentEffort ? "active" : ""}" data-effort="${esc(l.id)}" onclick="setEffort('${esc(l.id)}')">${esc(l.label)}</button>`
      )
      .join("");
  }
}

export function onModelChange(val) {
  if (cs.currentEngine !== "compare") {
    cs.engineSettings[cs.currentEngine].model = val;
  }
  const stripModel = $("mobileStripModel");
  if (stripModel) stripModel.textContent = val;
  const mobSelect = /** @type {HTMLSelectElement} */ ($("mobileModelSelect"));
  if (mobSelect && mobSelect.value !== val) mobSelect.value = val;
  const chatModel = /** @type {HTMLSelectElement} */ ($("chatModelSelect"));
  if (chatModel && chatModel.value !== val) chatModel.value = val;
}

export function setEffort(lvl) {
  if (cs.currentEngine !== "compare") {
    cs.engineSettings[cs.currentEngine].effort = lvl;
    document.querySelectorAll(".effort-btn").forEach((btn) => {
      btn.classList.toggle("active", /** @type {HTMLElement} */ (btn).dataset.effort === lvl);
    });
    document.querySelectorAll(".sheet-effort-btn").forEach((btn) => {
      btn.classList.toggle("active", /** @type {HTMLElement} */ (btn).dataset.effort === lvl);
    });
  }
}

export function updateEngineAuthBadge() {
  const eng = cs.enginesMeta[cs.currentEngine];
  if (eng) {
    const badge = $("engineAuthBadge");
    if (badge) {
      badge.textContent = eng.auth;
      // PI-2: destaca motor local com badge verde (sem alteração no fluxo)
      const isLocal = cs.currentEngine === "ollama";
      badge.classList.toggle("engine-auth-badge--local", isLocal);
    }
    const inp = /** @type {HTMLInputElement} */ ($("chatInput"));
    if (inp) inp.placeholder = "Escreva uma mensagem...";
  }
  updateEngineControls();
  const sId = getEngineSession(state.P?.slug, cs.currentChatFile, cs.currentEngine);
  const stText = $("chatStatusText");
  if (stText) stText.textContent = sId ? `Sessão ativa (${cs.currentEngine}): ${sId.slice(0, 14)}...` : "";
  if (typeof updateMobileChatHeader === "function") {
    updateMobileChatHeader(state.P ? state.P.slug : "", cs.currentEngine);
  }
}

export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toggleCompareEngine(eng) {
  const capEng = cap(eng);
  const chk1 = /** @type {HTMLInputElement} */ ($("chkCompare" + capEng));
  const chk2 = /** @type {HTMLInputElement} */ ($("chkStudioCompare" + capEng));
  const isChecked = chk1 ? chk1.checked : chk2 ? chk2.checked : false;

  const idx = cs.compareSelectedEngines.indexOf(eng);
  if (isChecked && idx < 0) {
    cs.compareSelectedEngines.push(eng);
  } else if (!isChecked && idx >= 0) {
    if (cs.compareSelectedEngines.length <= 1) {
      if (chk1) chk1.checked = true;
      if (chk2) chk2.checked = true;
      return;
    }
    cs.compareSelectedEngines.splice(idx, 1);
  }
  const active = cs.compareSelectedEngines.includes(eng);
  if (chk1) chk1.checked = active;
  if (chk2) chk2.checked = active;
  const chip1 = $("chip" + capEng);
  if (chip1) chip1.classList.toggle("active", active);
  const chip2 = $("studioChip" + capEng);
  if (chip2) chip2.classList.toggle("active", active);
  updateCompareDesc();
}

export function updateCompareDesc() {
  const text = `${cs.compareSelectedEngines.length} motores selecionados · streaming simultâneo`;
  const desc = $("compareEnginesDesc");
  if (desc) desc.textContent = text;
  const sDesc = $("studioCompareEnginesDesc");
  if (sDesc) sDesc.textContent = text;

  const badge = $("engineAuthBadge");
  if (badge && cs.currentEngine === "compare") {
    badge.textContent = `Arena de Comparação (${cs.compareSelectedEngines.length} motores ativos)`;
  }
}

export function switchEngine(eng) {
  cs.currentEngine = eng;
  state.currentEngine = eng;
  document.querySelectorAll(".eng-tab").forEach((tab) => {
    tab.classList.toggle("active", /** @type {HTMLElement} */ (tab).dataset.engine === eng);
  });

  const isComp = eng === "compare";
  const singleCtrl = $("singleControls");
  const compCtrl = $("compareControls");
  if (singleCtrl) singleCtrl.style.display = isComp ? "none" : "flex";
  if (compCtrl) compCtrl.style.display = isComp ? "flex" : "none";

  const sSingleCtrl = $("studioSingleControls");
  const sCompCtrl = $("studioCompareControls");
  if (sSingleCtrl) sSingleCtrl.style.display = isComp ? "none" : "flex";
  if (sCompCtrl) sCompCtrl.style.display = isComp ? "flex" : "none";

  const inp = /** @type {HTMLInputElement} */ ($("chatInput"));
  const sInp = /** @type {HTMLInputElement} */ ($("studioChatInput"));
  const stText = $("chatStatusText");

  if (isComp) {
    updateCompareDesc();
    if (inp) inp.placeholder = "Envie uma pergunta para comparar os motores...";
    if (sInp) sInp.placeholder = "Envie uma pergunta para comparar os motores...";
    if (stText) stText.textContent = "Modo Comparação ativo.";
  } else {
    updateEngineAuthBadge();
  }
  if (typeof updateMobileChatHeader === "function") {
    updateMobileChatHeader(state.P ? state.P.slug : "", eng);
  }
}

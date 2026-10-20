// @ts-check
// Gerenciamento de grupos e subgrupos (modal, paleta, lista).
import { esc } from "../shared/dom.js";
import { state, GROUP_PALETTE } from "../shared/state.js";
import { getProjectGroups, getGroupById, saveGroupsData } from "./groups-data.js";
import { closeBatchSuggestContainer } from "./groups-classify.js";

export function renderColorPalettePicker(containerId, currentSelectedColor) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = GROUP_PALETTE.map((p) => {
    const isSel = p.hex.toLowerCase() === (currentSelectedColor || "").toLowerCase();
    return `<div class="color-swatch ${isSel ? "selected" : ""}" style="background:${p.hex}" data-hex="${p.hex}" title="${esc(p.name)}" onclick="selectGroupColor('${p.hex}')"></div>`;
  }).join("");
}

export function selectGroupColor(hex) {
  state.selectedGroupColor = hex;
  renderColorPalettePicker("newGroupColorPicker", hex);
}

export function openManageGroupsModal() {
  state.editingGroupId = null;
  closeBatchSuggestContainer();
  $("groupFormIcon").textContent = "➕";
  $("groupFormTitle").textContent = "Criar Novo Grupo de Contexto";
  $("newGroupNameInput").value = "";
  $("newGroupSubgroupsInput").value = "";
  $("btnSubmitGroup").textContent = "+ Criar Grupo";
  $("btnCancelEditGroup").style.display = "none";
  state.selectedGroupColor = GROUP_PALETTE[0].hex;
  renderColorPalettePicker("newGroupColorPicker", state.selectedGroupColor);
  renderManageGroupsList();
  /** @type {any} */ ($("manageGroupsDlg")).showModal();
}

export function cancelEditGroup() {
  state.editingGroupId = null;
  $("groupFormIcon").textContent = "➕";
  $("groupFormTitle").textContent = "Criar Novo Grupo de Contexto";
  $("newGroupNameInput").value = "";
  $("newGroupSubgroupsInput").value = "";
  $("btnSubmitGroup").textContent = "+ Criar Grupo";
  $("btnCancelEditGroup").style.display = "none";
  state.selectedGroupColor = GROUP_PALETTE[0].hex;
  renderColorPalettePicker("newGroupColorPicker", state.selectedGroupColor);
}

export function editGroup(groupId) {
  const grp = getGroupById(groupId);
  if (!grp) return;
  state.editingGroupId = groupId;
  $("groupFormIcon").textContent = "✏️";
  $("groupFormTitle").textContent = `Editar Grupo "${grp.name}"`;
  $("newGroupNameInput").value = grp.name;
  $("newGroupSubgroupsInput").value = (grp.subgroups || []).join(", ");
  $("btnSubmitGroup").textContent = "💾 Atualizar Grupo";
  $("btnCancelEditGroup").style.display = "inline-flex";
  state.selectedGroupColor = grp.color || GROUP_PALETTE[0].hex;
  renderColorPalettePicker("newGroupColorPicker", state.selectedGroupColor);
  $("newGroupNameInput").focus();
}

export function submitCreateOrUpdateGroup() {
  const name = $("newGroupNameInput").value.trim();
  if (!name) {
    alert("Por favor, informe um nome para o grupo.");
    return;
  }
  const rawSubs = $("newGroupSubgroupsInput").value;
  const subgroups = rawSubs
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const grps = getProjectGroups().slice();

  if (state.editingGroupId) {
    const target = grps.find((g) => g.id === state.editingGroupId);
    if (target) {
      target.name = name;
      target.color = state.selectedGroupColor;
      subgroups.forEach((s) => {
        if (!target.subgroups.includes(s)) target.subgroups.push(s);
      });
    }
  } else {
    const id = "grp_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    grps.push({
      id,
      name,
      color: state.selectedGroupColor,
      subgroups,
      createdAt: Date.now(),
    });
  }

  saveGroupsData(grps);
  cancelEditGroup();
  renderManageGroupsList();
}

export function deleteGroup(groupId) {
  const grp = getGroupById(groupId);
  if (!grp) return;
  if (
    !confirm(
      `Tem certeza que deseja remover o grupo "${grp.name}"? As conversas associadas não serão apagadas, apenas desvinculadas.`
    )
  )
    return;

  let grps = getProjectGroups().filter((g) => g.id !== groupId);
  const assigns = { ...getProjectAssignments() };
  Object.keys(assigns).forEach((k) => {
    if (assigns[k].groupId === groupId || assigns[k].group === grp.name) {
      delete assigns[k];
    }
  });

  if (state.chatGroupFilter === groupId) {
    state.chatGroupFilter = "all";
    state.chatSubgroupFilter = "all";
  }

  saveGroupsData(grps, assigns);
  renderManageGroupsList();
}

export function addSubgroupInline(groupId, inputEl) {
  const text = (inputEl.value || "").trim();
  if (!text) return;
  const grps = getProjectGroups().slice();
  const target = grps.find((g) => g.id === groupId);
  if (target) {
    if (!target.subgroups) target.subgroups = [];
    if (!target.subgroups.includes(text)) {
      target.subgroups.push(text);
      saveGroupsData(grps);
      renderManageGroupsList();
    }
  }
  inputEl.value = "";
}

export function removeSubgroup(groupId, subName) {
  const grps = getProjectGroups().slice();
  const target = grps.find((g) => g.id === groupId);
  if (target && target.subgroups) {
    target.subgroups = target.subgroups.filter((s) => s !== subName);
    const assigns = { ...getProjectAssignments() };
    Object.keys(assigns).forEach((k) => {
      if ((assigns[k].groupId === groupId || assigns[k].group === target.name) && assigns[k].subgroup === subName) {
        assigns[k].subgroup = "";
      }
    });
    saveGroupsData(grps, assigns);
    renderManageGroupsList();
  }
}

export function renderManageGroupsList() {
  const P = state.P;
  const grps = getProjectGroups();
  $("manageGroupsCount").textContent = `${grps.length} grupo${grps.length === 1 ? "" : "s"}`;

  if (!grps.length) {
    $("manageGroupsList").innerHTML =
      '<div class="empty" style="text-align:center;padding:24px">Nenhum grupo cadastrado ainda. Use o formulário acima para criar seu primeiro grupo!</div>';
    return;
  }

  const counts = {};
  if (P && P.chats) {
    P.chats.forEach((c) => {
      if (c.groupId) counts[c.groupId] = (counts[c.groupId] || 0) + 1;
      else if (c.group) counts[c.group] = (counts[c.group] || 0) + 1;
    });
  }

  $("manageGroupsList").innerHTML = grps
    .map((g) => {
      const cCount = counts[g.id] || counts[g.name] || 0;
      const subsHtml =
        g.subgroups && g.subgroups.length
          ? g.subgroups
              .map(
                (s) => `
            <span class="subgroup-tag">
              <span>${esc(s)}</span>
              <button type="button" class="btn-del-sub" title="Remover subgrupo" onclick="removeSubgroup('${esc(g.id)}', '${esc(s)}')">×</button>
            </span>
          `
              )
              .join("")
          : '<span style="font-size:11.5px;color:var(--mute);font-style:italic">Nenhum subgrupo</span>';

      return `
        <div class="grp-manage-card">
          <div class="grp-manage-head">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="grp-dot" style="background:${esc(g.color || "#d97757")}"></span>
              <b style="font-size:14px;color:var(--text)">${esc(g.name)}</b>
              <span class="tag" style="font-size:11px">${cCount} conversa${cCount === 1 ? "" : "s"}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn-chat-action" style="font-size:11.5px;padding:3px 8px" onclick="editGroup('${esc(g.id)}')">✏️ Editar</button>
              <button type="button" class="btn-cancel-single" style="font-size:11px;padding:2px 8px" onclick="deleteGroup('${esc(g.id)}')">🗑️ Excluir</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
            <div style="font-size:11.5px;color:var(--mute);font-weight:600">Subgrupos:</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              ${subsHtml}
            </div>
            <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
              <input type="text" id="inSub_${esc(g.id)}" class="chats-search-input" placeholder="+ Adicionar subgrupo..." style="max-width:200px;padding:4px 8px;font-size:12px" onkeydown="if(event.key==='Enter') addSubgroupInline('${esc(g.id)}', this)">
              <button type="button" class="btn-chat-action" style="font-size:11.5px;padding:4px 8px" onclick="addSubgroupInline('${esc(g.id)}', $('inSub_${esc(g.id)}'))">+</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

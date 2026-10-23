// @ts-check
// Atribuição de conversas a grupos e sugestão individual.
import { esc } from "../shared/dom.js";
import { state, persistChatScreenState, logChatAction, CHAT_ACTIONS } from "../shared/state.js";
import { getProjectGroups, getGroupById, saveGroupsData } from "./groups-data.js";

export function openAssignChatGroupModal(chatName) {
  const P = state.P;
  if (!P) return;
  state.assigningChatName = chatName;
  const banner = $("assignChatSuggestBanner");
  if (banner) banner.style.display = "none";
  const c = (P.chats || []).find((x) => x.name === chatName);
  const title = c && c.title ? c.title : chatName.replace(/\.md$/, "");
  const agent = c ? c.agent || "claude" : "claude";
  const agBadge =
    agent === "gemini"
      ? '<span class="tag" style="color:#7ca5f5;border-color:#7ca5f544;font-weight:600">✦ Gemini</span>'
      : agent === "opencode"
      ? '<span class="tag" style="color:#7de2a3;border-color:#7de2a344;font-weight:600">◆ OpenCode</span>'
      : '<span class="tag" style="color:#d97757;border-color:#d9775744;font-weight:600">✱ Claude</span>';

  $("assignChatTitle").textContent = title;
  $("assignChatMeta").innerHTML = `${agBadge} <span style="font-family:monospace">${esc(chatName)}</span>`;

  const grps = getProjectGroups();
  const currentGroupId = c ? c.groupId || "" : "";
  const currentSubgroup = c ? c.subgroup || "" : "";

  let opts = '<option value="">-- Sem Grupo (Não categorizado) --</option>';
  grps.forEach((g) => {
    opts += `<option value="${esc(g.id)}" ${g.id === currentGroupId ? "selected" : ""}>📁 ${esc(g.name)}</option>`;
  });
  $("assignGroupSelect").innerHTML = opts;

  $("btnRemoveChatGroup").style.display = c && (c.groupId || c.group) ? "inline-flex" : "none";

  onAssignGroupSelectChange(currentGroupId, currentSubgroup);
  /** @type {any} */ ($("assignChatDlg")).showModal();
}

export function onAssignGroupSelectChange(groupId, presetSubgroup = null) {
  const grp = getGroupById(groupId);
  const wrap = $("assignSubgroupWrap");
  const subSel = $("assignSubgroupSelect");
  const customWrap = $("assignCustomSubgroupWrap");
  const customInput = $("assignCustomSubgroupInput");

  customWrap.style.display = "none";
  customInput.value = "";

  if (!grp) {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";
  let subOpts = '<option value="">-- Nenhum Subgrupo --</option>';
  (grp.subgroups || []).forEach((s) => {
    const isSel = presetSubgroup ? s === presetSubgroup : false;
    subOpts += `<option value="${esc(s)}" ${isSel ? "selected" : ""}>${esc(s)}</option>`;
  });
  subOpts += '<option value="__new__">➕ Novo Subgrupo...</option>';
  subSel.innerHTML = subOpts;

  if (presetSubgroup && grp.subgroups && !grp.subgroups.includes(presetSubgroup)) {
    subSel.value = "__new__";
    customWrap.style.display = "block";
    customInput.value = presetSubgroup;
  }
}

export function onAssignSubgroupSelectChange(val) {
  const customWrap = $("assignCustomSubgroupWrap");
  if (val === "__new__") {
    customWrap.style.display = "block";
    $("assignCustomSubgroupInput").focus();
  } else {
    customWrap.style.display = "none";
  }
}

export async function saveChatGroupAssignment() {
  const P = state.P;
  const assigningChatName = state.assigningChatName;
  if (!assigningChatName || !P || !P.slug) return;
  const grpSel = $("assignGroupSelect");
  const subSel = $("assignSubgroupSelect");
  const customSub = $("assignCustomSubgroupInput");
  const groupId = grpSel.value;

  if (!groupId) {
    removeChatGroupAssignment();
    return;
  }

  const grpObj = getGroupById(groupId);
  const groupName = grpObj ? grpObj.name : groupId;
  let subgroup = subSel.value;
  if (subgroup === "__new__") {
    subgroup = customSub.value.trim();
    if (subgroup && grpObj) {
      if (!grpObj.subgroups) grpObj.subgroups = [];
      if (!grpObj.subgroups.includes(subgroup)) {
        grpObj.subgroups.push(subgroup);
        saveGroupsData(getProjectGroups());
      }
    }
  }

  if (!P.groups) P.groups = { groups: [], assignments: {} };
  if (!P.groups.assignments) P.groups.assignments = {};
  P.groups.assignments[assigningChatName] = {
    groupId,
    group: groupName,
    subgroup: subgroup || "",
  };

  const c = (P.chats || []).find((x) => x.name === assigningChatName);
  if (c) {
    c.groupId = groupId;
    c.group = groupName;
    c.subgroup = subgroup || "";
  }

  persistChatScreenState({
    groups: P.groups.groups || [],
    assignments: P.groups.assignments || {},
  });
  void logChatAction(CHAT_ACTIONS.GROUP, assigningChatName);

  try {
    await fetch("/api/project/" + encodeURIComponent(P.slug) + "/chat-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatName: assigningChatName,
        groupId,
        group: groupName,
        subgroup: subgroup || "",
      }),
    });
  } catch (err) {
    console.warn("[saveChatGroupAssignment] Falha ao enviar para API:", err);
  }

  /** @type {any} */ ($("assignChatDlg")).close();
  if (window.renderProjectChats) window.renderProjectChats();
}

export async function removeChatGroupAssignment() {
  const P = state.P;
  const assigningChatName = state.assigningChatName;
  if (!assigningChatName || !P || !P.slug) return;
  if (P.groups && P.groups.assignments) {
    delete P.groups.assignments[assigningChatName];
  }
  const c = (P.chats || []).find((x) => x.name === assigningChatName);
  if (c) {
    c.groupId = "";
    c.group = "";
    c.subgroup = "";
  }
  persistChatScreenState({
    groups: (P.groups && P.groups.groups) || [],
    assignments: (P.groups && P.groups.assignments) || {},
  });
  void logChatAction(CHAT_ACTIONS.GROUP, assigningChatName);
  try {
    await fetch("/api/project/" + encodeURIComponent(P.slug) + "/chat-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatName: assigningChatName,
        remove: true,
      }),
    });
  } catch (err) {}
  /** @type {any} */ ($("assignChatDlg")).close();
  if (window.renderProjectChats) window.renderProjectChats();
}

export async function requestSingleChatSuggestion() {
  const P = state.P;
  const assigningChatName = state.assigningChatName;
  if (!assigningChatName || !P || !P.slug) return;
  const btn = $("btnSuggestChatGroup");
  const banner = $("assignChatSuggestBanner");
  const origBtnText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">⏳</span> Analisando...`;
  }
  try {
    const res = await fetch("/api/project/" + encodeURIComponent(P.slug) + "/groups/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatName: assigningChatName }),
    });
    const data = await res.json();
    if (!data.ok || !data.suggestion) {
      alert("Não foi possível gerar sugestão para esta conversa.");
      return;
    }

    const sug = data.suggestion;
    const grps = getProjectGroups();

    // Mostra o banner explicativo
    if (banner) {
      banner.style.display = "block";
      $("assignSuggestConfidence").textContent = `Confiança: ${Math.round((sug.confidence || 0.8) * 100)}%`;
      const subTxt = sug.subgroup ? ` › <i>${esc(sug.subgroup)}</i>` : "";
      $("assignSuggestText").innerHTML = `📁 ${esc(sug.group)}${subTxt}`;
      $("assignSuggestReason").textContent = sug.reason || "Classificação semântica do conteúdo da conversa.";
    }

    // Se o grupo sugerido já existe pelo id ou pelo nome
    let matchedGroup = grps.find(
      (g) => (sug.groupId && g.id === sug.groupId) || g.name.toLowerCase() === (sug.group || "").toLowerCase()
    );

    // Se não existir, adiciona dinamicamente ao projeto
    if (!matchedGroup && sug.group) {
      const newId = "grp_" + Date.now().toString(36);
      matchedGroup = {
        id: newId,
        name: sug.group,
        color: sug.color || "#d97757",
        subgroups: sug.subgroup ? [sug.subgroup] : [],
        createdAt: Date.now(),
      };
      grps.push(matchedGroup);
      await saveGroupsData(grps);
      // Re-popula select de grupos
      let opts = '<option value="">-- Sem Grupo (Não categorizado) --</option>';
      grps.forEach((g) => {
        opts += `<option value="${esc(g.id)}">📁 ${esc(g.name)}</option>`;
      });
      $("assignGroupSelect").innerHTML = opts;
    }

    if (matchedGroup) {
      $("assignGroupSelect").value = matchedGroup.id;
      onAssignGroupSelectChange(matchedGroup.id, sug.subgroup || null);
    }
  } catch (err) {
    alert("Erro ao sugerir grupo: " + (err.message || String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
}

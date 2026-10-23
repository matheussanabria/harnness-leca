// @ts-check
// Leitura e gravação dos grupos e atribuições do projeto.
import { state, getChatScreenState, persistChatScreenState } from "../shared/state.js";

export function getProjectGroups() {
  const P = state.P;
  if (P && P.groups && Array.isArray(P.groups.groups)) return P.groups.groups;
  const cached = getChatScreenState();
  if (Array.isArray(cached.groups)) return cached.groups;
  return [];
}

export function getProjectAssignments() {
  const P = state.P;
  if (P && P.groups && typeof P.groups.assignments === "object" && P.groups.assignments !== null) {
    return P.groups.assignments;
  }
  const cached = getChatScreenState();
  if (cached.assignments && typeof cached.assignments === "object" && !Array.isArray(cached.assignments)) {
    return cached.assignments;
  }
  return {};
}

export function getGroupById(groupId) {
  const grps = getProjectGroups();
  return grps.find((g) => g.id === groupId || g.name === groupId) || null;
}

export async function saveGroupsData(groupsList, assignmentsMap) {
  const P = state.P;
  if (!P || !P.slug) return;
  if (!P.groups) P.groups = { groups: [], assignments: {} };
  P.groups.groups = groupsList;
  if (assignmentsMap) P.groups.assignments = assignmentsMap;

  const assigns = P.groups.assignments || {};
  (P.chats || []).forEach((c) => {
    const a = assigns[c.name];
    c.group = a ? a.group || a.groupId || "" : "";
    c.groupId = a ? a.groupId || "" : "";
    c.subgroup = a ? a.subgroup || "" : "";
  });

  persistChatScreenState({
    groups: P.groups.groups || [],
    assignments: P.groups.assignments || {},
  });

  try {
    await fetch("/api/project/" + encodeURIComponent(P.slug) + "/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(P.groups),
    });
  } catch (err) {
    console.warn("[saveGroupsData] Mantendo alteração local:", err);
  }

  if (window.renderProjectChats) window.renderProjectChats();
}

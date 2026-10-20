// @ts-check
// Leitura e gravação dos grupos e atribuições do projeto.
import { state } from "../shared/state.js";

export function getProjectGroups() {
  const P = state.P;
  if (P && P.groups && Array.isArray(P.groups.groups)) return P.groups.groups;
  try {
    const raw = localStorage.getItem("harness_groups_" + (P ? P.slug : ""));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.groups)) return parsed.groups;
    }
  } catch {}
  return [];
}

export function getProjectAssignments() {
  const P = state.P;
  if (P && P.groups && typeof P.groups.assignments === "object" && P.groups.assignments !== null) {
    return P.groups.assignments;
  }
  try {
    const raw = localStorage.getItem("harness_groups_" + (P ? P.slug : ""));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.assignments) return parsed.assignments;
    }
  } catch {}
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

  try {
    localStorage.setItem("harness_groups_" + P.slug, JSON.stringify(P.groups));
  } catch {}

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

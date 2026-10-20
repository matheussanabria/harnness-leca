// @ts-check
// Acoes globais do Scrum.
import { $, showToast, autoGrow } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";
import { loadScrumData } from "./design-scrum-data.js";

function findStory(id) {
  return ds.currentScrumData?.stories?.find((story) => story.id === id || story.key === id);
}

async function postScrum(path, payload) {
  const slug = state.P?.name || state.S?.active;
  const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Falha na operacao.");
  ds.currentScrumData = data.scrum;
  renderCurrentScrumView();
}

export function registerScrumActions() {
  window.openEditStoryById = (id) => {
    const story = findStory(id);
    if (story) window.openEditStoryModal(story);
  };
  window.sendStoryToChatById = (id) => {
    const story = findStory(id);
    if (story) window.sendStoryToChat(story);
  };
  window.switchScrumTab = (tab) => {
    ds.currentScrumTab = tab;
    renderCurrentScrumView();
  };
  window.onSelectSprintChange = async (sprintId) => {
    ds.selectedSprintFilter = sprintId;
    if (sprintId && sprintId !== "all") {
      const slug = state.P?.name || state.S?.active;
      try {
        await postScrum("sprint", { id: sprintId, makeActive: true });
        await loadScrumData(slug);
      } catch (err) {
        console.warn("[scrum] Falha ao definir sprint ativa no backend:", err);
      }
    }
    renderCurrentScrumView();
  };
  window.moveStoryStatus = async (storyId, status) => {
    try {
      await postScrum("story/status", { storyId, status });
      showToast("Status da historia atualizado.");
    } catch (error) { showToast(error.message); }
  };
  window.assignStoryToSprint = async (storyId, sprintId) => {
    try {
      await postScrum("story/assign-sprint", { storyId, sprintId });
      showToast(sprintId ? "Historia alocada na sprint." : "Historia movida para o backlog.");
    } catch (error) { showToast(error.message); }
  };
  window.confirmDeleteStory = async (storyId) => {
    const title = findStory(storyId)?.title || storyId;
    if (!confirm(`Deseja realmente excluir a historia "${title}"?`)) return;
    try {
      await postScrum("story/delete", { storyId });
      showToast("Historia excluida.");
    } catch (error) { showToast(error.message); }
  };
  window.onEpicFilterChange = (value) => {
    ds.currentEpicFilter = value;
    renderCurrentScrumView();
  };
  window.onScrumSearchInput = (value) => {
    ds.currentSearchQuery = value;
    renderCurrentScrumView();
  };
  window.sendStoryToChat = (story) => {
    const criteria = (story.acceptanceCriteria || []).map((item) => typeof item === "string" ? item : `${item.label}: ${item.content}`);
    const text = `<historia-usuario>\nchave: ${story.key}\ntitulo: ${story.title}\npontos: ${story.points ?? "nao informado"}\nprioridade: ${story.priority ?? "nao informada"}\nstatus: ${story.status}\ndescricao: ${story.description || "nao informada"}\ncriterios_aceite:\n${criteria.map((item) => `- ${item}`).join("\n")}\n</historia-usuario>\n\nImplemente esta historia de usuario atendendo a todos os criterios de aceite.`;
    const input = /** @type {HTMLTextAreaElement} */ ($("chatInput") || $("studioChatInput"));
    if (!input) return;
    input.value = input.value.trim() ? `${text}\n\n${input.value.trim()}` : `${text}\n\n`;
    autoGrow(input);
    input.focus();
    showToast(`Historia ${story.key} inserida no chat.`);
  };
}

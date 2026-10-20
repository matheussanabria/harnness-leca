// @ts-check
// Normalizacao apenas de historias criadas localmente; fontes externas usam adaptadores proprios.

function normalizeStatus(value) {
  const status = String(value || "todo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["done", "concluido"].includes(status)) return "done";
  if (["in_progress", "progresso", "fazendo"].includes(status)) return "in_progress";
  if (["review", "teste", "qa"].includes(status)) return "review";
  return "todo";
}

function normalizeCriteria(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item.trim() : item).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split("\n").map((item) => item.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function optionalPriority(value) {
  if (value === null || value === undefined || value === "") return null;
  const priority = String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["baixa", "media", "alta", "critica"].includes(priority) ? priority : null;
}

function sanitizeStory(story, defaultSprintId = null) {
  const id = String(story.id || story.key || `us-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
  return {
    id,
    key: String(story.key || id.toUpperCase()),
    title: String(story.title || story.summary || "Sem titulo").trim(),
    description: story.description ? String(story.description).trim() : null,
    acceptanceCriteria: normalizeCriteria(story.acceptanceCriteria),
    epicId: story.epicId ? String(story.epicId) : null,
    sprintId: story.sprintId !== undefined ? (story.sprintId ? String(story.sprintId) : null) : defaultSprintId,
    status: normalizeStatus(story.status),
    points: optionalNumber(story.points),
    priority: optionalPriority(story.priority),
    assignee: story.assignee ? String(story.assignee) : null,
    updatedAt: story.updatedAt || new Date().toISOString(),
  };
}

module.exports = { sanitizeStory };

// @ts-check
// Extrai sprints do payload da issue sem depender do id do campo (customfield varia por instancia).

const LEGACY_PATTERN = /Sprint@[0-9a-f]+\[(.*)\]/i;

function parseLegacySprint(text) {
  const match = LEGACY_PATTERN.exec(text);
  if (!match) return null;
  const attrs = {};
  // Valores do Jira Server: id=12,rapidViewId=3,state=ACTIVE,name=Sprint 3,startDate=...
  for (const part of match[1].split(/,(?=\w+=)/)) {
    const index = part.indexOf("=");
    if (index > 0) attrs[part.slice(0, index)] = part.slice(index + 1);
  }
  return attrs.id ? attrs : null;
}

function toSprint(raw) {
  const data = typeof raw === "string" ? parseLegacySprint(raw) : raw;
  if (!data || data.id === undefined || data.id === null || !data.name) return null;
  const date = (value) => (value && value !== "<null>" ? String(value) : null);
  return {
    id: `jira-${data.id}`,
    jiraId: String(data.id),
    name: String(data.name),
    state: String(data.state || "").toLowerCase() || null,
    startDate: date(data.startDate),
    endDate: date(data.endDate),
    goal: data.goal && data.goal !== "<null>" ? String(data.goal) : "",
  };
}

function looksLikeSprint(item) {
  if (typeof item === "string") return LEGACY_PATTERN.test(item);
  return Boolean(item && typeof item === "object" && item.name && item.id !== undefined && ("state" in item || "startDate" in item || "boardId" in item));
}

/** Retorna as sprints da issue, da mais antiga para a mais recente. */
function extractIssueSprints(fields = {}) {
  const found = [];
  for (const [name, value] of Object.entries(fields)) {
    if (name !== "sprint" && !name.startsWith("customfield_")) continue;
    const items = Array.isArray(value) ? value : [value];
    if (!items.length || !items.every((item) => item && looksLikeSprint(item))) continue;
    found.push(...items.map(toSprint).filter(Boolean));
  }
  return found.sort((a, b) => Number(a.jiraId) - Number(b.jiraId));
}

/** Sprint vigente da historia: a ativa mais recente, senao a mais recente (ultima em que esteve). */
function currentSprint(sprints) {
  // Ids do Jira nao seguem a ordem das sprints; a data de inicio decide.
  const latest = (list) => [...list].sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || ""))).pop() || null;
  return latest(sprints.filter((sprint) => sprint.state === "active")) || latest(sprints);
}

function isSprintField(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.length > 0 && items.every((item) => item && looksLikeSprint(item));
}

module.exports = { extractIssueSprints, currentSprint, isSprintField };

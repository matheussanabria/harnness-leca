// @ts-check
// Fachada de project-scrum.service: reexporta a API pública dos módulos (project-scrum-sanitize, project-scrum-defaults, project-scrum-persist, project-scrum-ops).
const { loadProjectScrum, saveProjectScrum } = require("./project-scrum-persist");
const { upsertStory, updateStoryStatus, moveStoryToLane, assignStorySprint, setStoryImpediment, deleteStory, upsertEpic, upsertSprint, updateStatusMapping, updateLanes, reorderLanes } = require("./project-scrum-ops");

module.exports = { loadProjectScrum, saveProjectScrum, upsertStory, updateStoryStatus, moveStoryToLane, assignStorySprint, setStoryImpediment, deleteStory, upsertEpic, upsertSprint, updateStatusMapping, updateLanes, reorderLanes };

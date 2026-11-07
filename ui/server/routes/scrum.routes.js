// @ts-check
const {
  apiProjectScrumGet,
  apiProjectScrumStorySave,
  apiProjectScrumStoryStatus,
  apiProjectScrumStoryAssignSprint,
  apiProjectScrumStoryImpediment,
  apiProjectScrumStoryDelete,
  apiProjectScrumEpicSave,
  apiProjectScrumSprintSave,
  apiProjectScrumStatusMappingSave,
  apiProjectScrumLanesSave,
  apiProjectScrumLanesOrder,
} = require("../controllers/scrum.controller");
const { apiProjectScrumJiraSync } = require("../controllers/scrum-jira-sync.controller");
const { apiProjectScrumStoryCapture, apiProjectScrumDuplicates } = require("../controllers/scrum-capture.controller");
const { apiProjectScrumStoryTransition } = require("../controllers/scrum-transition.controller");
const { apiProjectScrumStoryCommits, apiProjectScrumStoryDor } = require("../controllers/scrum-trace.controller");
const { apiProjectCoordinationLanes } = require("../controllers/coordination-view.controller");
const { apiProjectScrumPanel } = require("../controllers/scrum-panel.controller");

const scrumRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum$/, handler: apiProjectScrumGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/jira-sync$/, handler: apiProjectScrumJiraSync },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story$/, handler: apiProjectScrumStorySave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/capture$/, handler: apiProjectScrumStoryCapture },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/duplicates$/, handler: apiProjectScrumDuplicates },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/status$/, handler: apiProjectScrumStoryStatus },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/transition$/, handler: apiProjectScrumStoryTransition },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/([\w.-]+)\/commits$/, handler: apiProjectScrumStoryCommits },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/([\w.-]+)\/dor$/, handler: apiProjectScrumStoryDor },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/coordination\/lanes$/, handler: apiProjectCoordinationLanes },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/scrum\/panel$/, handler: apiProjectScrumPanel },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/assign-sprint$/, handler: apiProjectScrumStoryAssignSprint },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/impediment$/, handler: apiProjectScrumStoryImpediment },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/story\/delete$/, handler: apiProjectScrumStoryDelete },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/epic$/, handler: apiProjectScrumEpicSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/sprint$/, handler: apiProjectScrumSprintSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/status-mapping$/, handler: apiProjectScrumStatusMappingSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/lanes$/, handler: apiProjectScrumLanesSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/lanes\/order$/, handler: apiProjectScrumLanesOrder },
];

module.exports = { scrumRoutes };

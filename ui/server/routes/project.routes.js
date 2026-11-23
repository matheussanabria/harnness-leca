// @ts-check
const { apiEngines } = require("../controllers/chat.controller");
const { apiOverview } = require("../controllers/overview.controller");
const { apiSync, apiProjectSync } = require("../controllers/sync.controller");
const { apiUnmatchedList, apiUnmatchedAssociate } = require("../controllers/unmatched.controller");
const {
  apiProjectActiveSet,
  apiProject,
  apiProjectGroupsGet,
  apiProjectGroupsSave,
  apiProjectGroupsSuggest,
  apiProjectChatGroupAssign,
} = require("../controllers/project.controller");
const { apiReviewList, apiReviewApply } = require("../controllers/review.controller");
const { apiClaudeAiList, apiClaudeAiImport } = require("../controllers/claude-ai-import.controller");

const projectRoutes = [
  { method: "GET", path: "/api/engines", handler: apiEngines },
  { method: "GET", path: "/api/overview", handler: apiOverview },
  { method: "POST", path: "/api/sync", handler: apiSync },
  { method: "GET", path: "/api/unmatched", handler: apiUnmatchedList },
  { method: "POST", path: "/api/unmatched/associate", handler: apiUnmatchedAssociate },
  { method: "POST", path: "/api/project/active", handler: apiProjectActiveSet },
  { method: "GET", path: /^\/api\/project\/([\w-]+)$/, handler: apiProject },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewApply },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/sync$/, handler: apiProjectSync },
  { method: "POST", path: "/api/claude-ai-import/list", handler: apiClaudeAiList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/claude-ai-import$/, handler: apiClaudeAiImport },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/groups$/, handler: apiProjectGroupsGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/groups$/, handler: apiProjectGroupsSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/groups\/suggest$/, handler: apiProjectGroupsSuggest },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/chat-group$/, handler: apiProjectChatGroupAssign },
];

module.exports = { projectRoutes };

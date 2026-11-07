// @ts-check
const { send } = require("../config");
const { getActiveAgentsSummary } = require("../services/agent-activity.service");
const { apiState } = require("../controllers/project.controller");
const { apiOrchestrationState, apiOrchestrationEvents, apiOrchestrationExecutionDetail } = require("../controllers/orchestration.controller");

function apiAgentsActive({ res }) {
  return send(res, 200, getActiveAgentsSummary());
}

const stateRoutes = [
  { method: "GET", path: "/api/state", handler: apiState },
  { method: "GET", path: "/api/agents/active", handler: apiAgentsActive },
  { method: "GET", path: "/api/orchestration/state", handler: apiOrchestrationState },
  { method: "GET", path: "/api/orchestration/events", handler: apiOrchestrationEvents },
  { method: "GET", path: /^\/api\/orchestration\/executions\/([\w-]+)$/, handler: apiOrchestrationExecutionDetail },
];

module.exports = { stateRoutes };

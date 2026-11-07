// @ts-check
const {
  apiDeployConfigGet,
  apiDeployConfigSave,
  apiDeployTrigger,
  apiDeployHistoryGet,
  apiDeployHistoryClear,
} = require("../controllers/deploy.controller");
const {
  apiDeployPipelines,
  apiDeployPipelinesSave,
  apiDeployPipelineRuns,
  apiDeployPipelineRun,
} = require("../controllers/deploy-pipeline.controller");
const { apiDeployHealth, apiDeployHealthChecksSave, apiDeployHealthCheckRun } = require("../controllers/deploy-health.controller");
const { apiDeployTimeline, apiDeployLogs } = require("../controllers/deploy-timeline.controller");
const { apiDeployActions, apiDeployActionAuthorize, apiDeployActionExecute } = require("../controllers/deploy-actions.controller");
const { apiDeployStatus } = require("../controllers/deploy-status.controller");

const deployRoutes = [
  { method: "GET", path: "/api/deploy/config", handler: apiDeployConfigGet },
  { method: "POST", path: "/api/deploy/config", handler: apiDeployConfigSave },
  { method: "POST", path: "/api/deploy/trigger", handler: apiDeployTrigger },
  { method: "GET", path: "/api/deploy/history", handler: apiDeployHistoryGet },
  { method: "POST", path: "/api/deploy/clear-history", handler: apiDeployHistoryClear },
  { method: "GET", path: "/api/deploy/pipelines", handler: apiDeployPipelines },
  { method: "POST", path: "/api/deploy/pipelines", handler: apiDeployPipelinesSave },
  { method: "GET", path: "/api/deploy/pipelines/runs", handler: apiDeployPipelineRuns },
  { method: "POST", path: /^\/api\/deploy\/pipelines\/([\w-]+)\/run$/, handler: apiDeployPipelineRun },
  { method: "GET", path: "/api/deploy/health", handler: apiDeployHealth },
  { method: "POST", path: "/api/deploy/health/checks", handler: apiDeployHealthChecksSave },
  { method: "POST", path: /^\/api\/deploy\/health\/checks\/([\w-]+)\/run$/, handler: apiDeployHealthCheckRun },
  { method: "GET", path: "/api/deploy/timeline", handler: apiDeployTimeline },
  { method: "GET", path: "/api/deploy/logs", handler: apiDeployLogs },
  { method: "GET", path: "/api/deploy/actions", handler: apiDeployActions },
  { method: "GET", path: "/api/deploy/status", handler: apiDeployStatus },
  { method: "POST", path: /^\/api\/deploy\/actions\/([\w-]+)\/authorize$/, handler: apiDeployActionAuthorize },
  { method: "POST", path: /^\/api\/deploy\/actions\/([\w-]+)\/execute$/, handler: apiDeployActionExecute },
];

module.exports = { deployRoutes };

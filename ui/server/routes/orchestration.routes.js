// @ts-check
const {
  apiOrchestrationCapabilities,
  apiOrchestrationCapabilityProvider,
} = require("../controllers/orchestration-capabilities.controller");
const {
  apiOrchestrationAgentStages,
  apiOrchestrationAgentStage,
} = require("../controllers/orchestration-agent-stages.controller");
const {
  apiOrchestrationWorkflows,
  apiOrchestrationWorkflow,
  apiProjectWorkflowPlan,
  apiProjectWorkflowRun,
} = require("../controllers/orchestration-workflows.controller");
const {
  apiOrchestrationWorkflowRuns,
  apiOrchestrationWorkflowRunDetail,
  apiOrchestrationWorkflowRunAdvance,
  apiOrchestrationWorkflowRunCancel,
} = require("../controllers/orchestration-workflow-runs.controller");
const {
  apiOrchestrationRoutines,
  apiProjectRoutines,
  apiProjectRoutineRun,
  apiProjectWorkflowHistory,
} = require("../controllers/orchestration-routines.controller");
const {
  apiOrchestrationApprovals,
  apiOrchestrationWorkflowRunApprove,
} = require("../controllers/orchestration-approvals.controller");

const orchestrationRoutes = [
  { method: "GET", path: "/api/orchestration/capabilities", handler: apiOrchestrationCapabilities },
  { method: "GET", path: /^\/api\/orchestration\/capabilities\/([\w-]+)$/, handler: apiOrchestrationCapabilityProvider },
  { method: "GET", path: "/api/orchestration/agent-stages", handler: apiOrchestrationAgentStages },
  { method: "GET", path: /^\/api\/orchestration\/agent-stages\/([\w-]+)$/, handler: apiOrchestrationAgentStage },
  { method: "GET", path: "/api/orchestration/workflows", handler: apiOrchestrationWorkflows },
  { method: "GET", path: /^\/api\/orchestration\/workflows\/([\w-]+)$/, handler: apiOrchestrationWorkflow },
  { method: "GET", path: "/api/orchestration/workflow-runs", handler: apiOrchestrationWorkflowRuns },
  { method: "GET", path: /^\/api\/orchestration\/workflow-runs\/([\w-]+)$/, handler: apiOrchestrationWorkflowRunDetail },
  { method: "POST", path: /^\/api\/orchestration\/workflow-runs\/([\w-]+)\/advance$/, handler: apiOrchestrationWorkflowRunAdvance },
  { method: "POST", path: /^\/api\/orchestration\/workflow-runs\/([\w-]+)\/cancel$/, handler: apiOrchestrationWorkflowRunCancel },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/workflow-plan\/([\w-]+)$/, handler: apiProjectWorkflowPlan },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/workflows\/([\w-]+)\/runs$/, handler: apiProjectWorkflowRun },
  { method: "GET", path: "/api/orchestration/routines", handler: apiOrchestrationRoutines },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/routines$/, handler: apiProjectRoutines },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/routines\/([\w-]+)\/run$/, handler: apiProjectRoutineRun },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/workflow-history$/, handler: apiProjectWorkflowHistory },
  { method: "GET", path: "/api/orchestration/approvals", handler: apiOrchestrationApprovals },
  { method: "POST", path: /^\/api\/orchestration\/workflow-runs\/([\w-]+)\/approve$/, handler: apiOrchestrationWorkflowRunApprove },
];

module.exports = { orchestrationRoutes };

// @ts-check
const { apiOrchestrationStream, apiOrchestrationOperation } = require("../controllers/orchestration.controller");

const orchestrationStreamRoutes = [
  { method: "GET", path: "/api/orchestration/stream", handler: apiOrchestrationStream },
  { method: "POST", path: "/api/orchestration/operations", handler: apiOrchestrationOperation },
];

module.exports = { orchestrationStreamRoutes };

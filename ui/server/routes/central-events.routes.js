// @ts-check
const {
  apiProjectEvents,
  apiProjectUsageSummary,
  apiProjectProjections,
  apiProjectEventStream,
  apiProjectEventPublish,
} = require("../controllers/central-events.controller");

const centralEventRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/events$/, handler: apiProjectEvents },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/events$/, handler: apiProjectEventPublish },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/projections$/, handler: apiProjectProjections },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/usage\/summary$/, handler: apiProjectUsageSummary },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/sessions\/stream$/, handler: apiProjectEventStream },
];

module.exports = { centralEventRoutes };

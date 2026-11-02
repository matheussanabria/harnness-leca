const {
  apiProjectEvents,
  apiProjectUsageSummary,
  apiUsageQuotas,
  apiProjectProjections,
  apiProjectEventStream,
  apiProjectEventPublish,
} = require("../controllers/central-events.controller");
const {
  apiProjectAttentionQueue,
  apiProjectAttentionAck,
  apiProjectAttentionResolve,
} = require("../controllers/central-attention.controller");

const centralEventRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/events$/, handler: apiProjectEvents },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/events$/, handler: apiProjectEventPublish },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/projections$/, handler: apiProjectProjections },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/usage\/summary$/, handler: apiProjectUsageSummary },
  { method: "GET", path: /^\/api\/usage\/quotas$/, handler: apiUsageQuotas },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/sessions\/stream$/, handler: apiProjectEventStream },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/attention$/, handler: apiProjectAttentionQueue },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/attention\/([\w-]+)\/ack$/, handler: apiProjectAttentionAck },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/attention\/([\w-]+)\/resolve$/, handler: apiProjectAttentionResolve },
];

module.exports = { centralEventRoutes };

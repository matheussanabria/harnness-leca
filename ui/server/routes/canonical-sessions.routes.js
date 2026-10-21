// @ts-check
const {
  apiProjectSessions,
  apiProjectSessionsScan,
  apiProjectSession,
  apiProjectSessionLink,
} = require("../controllers/canonical-session.controller");

const canonicalSessionRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/sessions$/, handler: apiProjectSessions },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/sessions\/scan$/, handler: apiProjectSessionsScan },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/sessions\/([^/]+)$/, handler: apiProjectSession },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/sessions\/([^/]+)\/link$/, handler: apiProjectSessionLink },
];

module.exports = { canonicalSessionRoutes };

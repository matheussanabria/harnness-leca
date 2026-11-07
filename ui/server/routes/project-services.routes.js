// @ts-check
const {
  apiProjectServicesGet,
  apiProjectServicesStart,
  apiProjectServicesStop,
  apiProjectServicesLogs,
  apiProjectServicesConfig,
} = require("../controllers/services.controller");

const projectServicesRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/services$/, handler: apiProjectServicesGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/start$/, handler: apiProjectServicesStart },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/stop$/, handler: apiProjectServicesStop },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/services\/logs$/, handler: apiProjectServicesLogs },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/services\/config$/, handler: apiProjectServicesConfig },
];

module.exports = { projectServicesRoutes };

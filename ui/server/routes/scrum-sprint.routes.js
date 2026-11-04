// @ts-check
const { apiProjectScrumSprintStart, apiProjectScrumSprintClose } = require("../controllers/scrum-sprint.controller");

// Sprint lifecycle: POST /api/project/:slug/scrum/sprint/:id/start and /close. Spread into ROUTES by router.js.
const scrumSprintRoutes = [
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/sprint\/([\w.-]+)\/start$/, handler: apiProjectScrumSprintStart },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/scrum\/sprint\/([\w.-]+)\/close$/, handler: apiProjectScrumSprintClose },
];

module.exports = { scrumSprintRoutes };

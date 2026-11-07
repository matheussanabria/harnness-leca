// @ts-check
// Route table of the HTTP server: one array per domain, in the order the router tries them.
// The first route whose path matches wins, so ORDER MATTERS: a specific path must come before a broader regex
// that would also match it (see the centralEventRoutes note below). Add a new domain as its own *.routes.js
// file and one line here; do not add inline routes to router.js. tests/route-registry.test.js checks that
// every *.routes.js file is listed here exactly once.
const { scrumRoutes } = require("./scrum.routes");
const { designRoutes } = require("./design.routes");
const { inspectRoutes } = require("./inspect.routes");
const { sourceRoutes } = require("./source.routes");
const { artifactRoutes } = require("./artifact.routes");
const { skillBindingRoutes } = require("./skill-bindings.routes");
const { catalogRoutes } = require("./catalog.routes");
const { auditRoutes } = require("./audit.routes");
const { centralEventRoutes } = require("./central-events.routes");
const { canonicalSessionRoutes } = require("./canonical-sessions.routes");
const { screensRoutes } = require("./screens.routes");
const { canvasRoutes } = require("./canvas.routes");
const { scrumSprintRoutes } = require("./scrum-sprint.routes");
const { engineActivityRoutes } = require("./engine-activity.routes");
const { stateRoutes } = require("./state.routes");
const { orchestrationRoutes } = require("./orchestration.routes");
const { orchestrationStreamRoutes } = require("./orchestration-stream.routes");
const { projectRoutes } = require("./project.routes");
const { projectSkillsRoutes } = require("./project-skills.routes");
const { projectServicesRoutes } = require("./project-services.routes");
const { appRoutes } = require("./app.routes");
const { chatRoutes } = require("./chat.routes");
const { permissionsRoutes } = require("./permissions.routes");
const { deployRoutes } = require("./deploy.routes");
const { hiaRoutes } = require("./hia.routes");

// method + path (exact text or RegExp). HEAD uses the GET route.
const ROUTES = [
  ...scrumRoutes,
  ...designRoutes,
  ...inspectRoutes,
  ...sourceRoutes,
  ...artifactRoutes,
  ...skillBindingRoutes,
  ...catalogRoutes,
  ...auditRoutes,
  // centralEventRoutes antes: /sessions/stream precisa vencer /sessions/([^/]+) (primeiro match ganha).
  ...centralEventRoutes,
  ...canonicalSessionRoutes,
  ...screensRoutes,
  ...canvasRoutes,
  ...scrumSprintRoutes,
  ...engineActivityRoutes,
  ...stateRoutes,
  ...orchestrationRoutes,
  ...orchestrationStreamRoutes,
  ...projectRoutes,
  ...projectSkillsRoutes,
  ...projectServicesRoutes,
  ...appRoutes,
  ...chatRoutes,
  ...permissionsRoutes,
  ...deployRoutes,
  ...hiaRoutes,
];

module.exports = { ROUTES };

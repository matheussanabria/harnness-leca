// @ts-check
// Read-only routes of the project documentation reader (doc/ of the project repo).
const {
  apiProjectDocsTree,
  apiProjectDocsCatalog,
  apiProjectDocsFile,
  apiProjectDocsRefs,
} = require("../controllers/project-docs.controller");

const projectDocsRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/docs\/tree$/, handler: apiProjectDocsTree },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/docs\/catalog$/, handler: apiProjectDocsCatalog },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/docs\/file$/, handler: apiProjectDocsFile },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/docs\/refs$/, handler: apiProjectDocsRefs },
];

module.exports = { projectDocsRoutes };

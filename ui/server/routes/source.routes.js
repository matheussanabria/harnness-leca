// @ts-check
const { apiProjectSourceFiles, apiProjectSourceFileGet, apiProjectSourceFileSave } = require("../controllers/source-workspace.controller");
const { apiProjectJournal } = require("../controllers/project.controller");

const sourceRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/source$/, handler: apiProjectSourceFiles },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/source\/file$/, handler: apiProjectSourceFileGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/source\/file$/, handler: apiProjectSourceFileSave },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/journal$/, handler: apiProjectJournal },
];

module.exports = { sourceRoutes };

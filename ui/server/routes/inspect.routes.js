// @ts-check
// Rotas de inspecao de codigo e edicao assistida (EP-11.01: extração para liberar o teto do router).
const {
  apiProjectInspectResolve,
  apiProjectInspectFile,
  apiProjectInspectComponents,
} = require("../controllers/inspect.controller");
const {
  apiProjectInspectEditPreview,
  apiProjectInspectEditApply,
  apiProjectInspectEditUndo,
  apiProjectInspectDsClasses,
} = require("../controllers/inspect-edit.controller");

const inspectRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/inspect\/components$/, handler: apiProjectInspectComponents },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/inspect\/resolve$/, handler: apiProjectInspectResolve },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/inspect\/file$/, handler: apiProjectInspectFile },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/inspect\/edit\/preview$/, handler: apiProjectInspectEditPreview },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/inspect\/edit\/apply$/, handler: apiProjectInspectEditApply },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/inspect\/edit\/undo$/, handler: apiProjectInspectEditUndo },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/inspect\/ds-classes$/, handler: apiProjectInspectDsClasses },
];

module.exports = { inspectRoutes };

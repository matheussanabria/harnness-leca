// @ts-check
const {
  apiPermissionRequest,
  apiPermissionAnswer,
  apiProjectPermissionsGet,
  apiProjectPermissionsRemove,
} = require("../controllers/permissions.controller");

const permissionsRoutes = [
  { method: "POST", path: "/api/permissions/request", handler: apiPermissionRequest },
  { method: "POST", path: "/api/permissions/answer", handler: apiPermissionAnswer },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/permissions$/, handler: apiProjectPermissionsGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/permissions\/remove$/, handler: apiProjectPermissionsRemove },
];

module.exports = { permissionsRoutes };

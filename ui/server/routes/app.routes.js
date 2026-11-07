// @ts-check
const { apiFile } = require("../controllers/project.controller");
const { apiDai, apiAppPing } = require("../controllers/chat.controller");
const { apiRemoteInfo, apiRemotePin } = require("../controllers/remote.controller");

const appRoutes = [
  { method: "GET", path: "/api/file", handler: apiFile },
  { method: "GET", path: "/api/dai", handler: apiDai },
  { method: "GET", path: "/api/app/ping", handler: apiAppPing },
  { method: "GET", path: "/api/remote/info", handler: apiRemoteInfo },
  { method: "POST", path: "/api/remote/pin", handler: apiRemotePin },
];

module.exports = { appRoutes };

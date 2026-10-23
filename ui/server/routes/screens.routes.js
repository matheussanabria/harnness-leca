// @ts-check
const {
  apiScreensCatalog,
  apiScreenStateGet,
  apiScreenStatePatch,
  apiScreenStateBeacon,
  apiScreenHistoryGet,
  apiScreenHistoryPost,
} = require("../controllers/screen-state.controller");

const screensRoutes = [
  { method: "GET", path: "/api/screens", handler: apiScreensCatalog },
  { method: "GET", path: /^\/api\/screens\/([\w-]+)\/state$/, handler: apiScreenStateGet },
  { method: "PATCH", path: /^\/api\/screens\/([\w-]+)\/state$/, handler: apiScreenStatePatch },
  { method: "POST", path: /^\/api\/screens\/([\w-]+)\/state$/, handler: apiScreenStateBeacon },
  { method: "GET", path: /^\/api\/screens\/([\w-]+)\/history$/, handler: apiScreenHistoryGet },
  { method: "POST", path: /^\/api\/screens\/([\w-]+)\/history$/, handler: apiScreenHistoryPost },
];

module.exports = { screensRoutes };

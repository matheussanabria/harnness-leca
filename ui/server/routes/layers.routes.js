// @ts-check
const { apiLayersGet, apiLayersCreate, apiLayersDelete } = require("../controllers/layers.controller");

const layersRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/layers$/, handler: apiLayersGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/layers$/, handler: apiLayersCreate },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/layers\/delete$/, handler: apiLayersDelete },
];

module.exports = { layersRoutes };

// @ts-check
const {
  apiLayersGet,
  apiLayersCreate,
  apiLayersDelete,
  apiLayersContentGet,
  apiLayersContentSave,
} = require("../controllers/layers.controller");

const layersRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/layers$/, handler: apiLayersGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/layers$/, handler: apiLayersCreate },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/layers\/delete$/, handler: apiLayersDelete },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/layers\/content$/, handler: apiLayersContentGet },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/layers\/content$/, handler: apiLayersContentSave },
];

module.exports = { layersRoutes };

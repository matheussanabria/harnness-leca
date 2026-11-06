// @ts-check
const { apiCatalogGet, apiCatalogAreaSet } = require("../controllers/catalog.controller");

const catalogRoutes = [
  { method: "GET", path: "/api/catalog", handler: apiCatalogGet },
  { method: "POST", path: "/api/catalog/area", handler: apiCatalogAreaSet },
];

module.exports = { catalogRoutes };

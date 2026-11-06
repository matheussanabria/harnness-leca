// @ts-check
const { apiCatalogGet, apiCatalogAreaSet, apiCatalogTree, apiCatalogFile } = require("../controllers/catalog.controller");

const catalogRoutes = [
  { method: "GET", path: "/api/catalog", handler: apiCatalogGet },
  { method: "POST", path: "/api/catalog/area", handler: apiCatalogAreaSet },
  { method: "GET", path: "/api/catalog/tree", handler: apiCatalogTree },
  { method: "GET", path: "/api/catalog/file", handler: apiCatalogFile },
];

module.exports = { catalogRoutes };

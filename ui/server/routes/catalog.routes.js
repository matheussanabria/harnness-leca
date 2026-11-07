// @ts-check
const { apiCatalogGet, apiCatalogAreaSet, apiCatalogTree, apiCatalogFile, apiCatalogFileSave } = require("../controllers/catalog.controller");

const catalogRoutes = [
  { method: "GET", path: "/api/catalog", handler: apiCatalogGet },
  { method: "POST", path: "/api/catalog/area", handler: apiCatalogAreaSet },
  { method: "GET", path: "/api/catalog/tree", handler: apiCatalogTree },
  { method: "GET", path: "/api/catalog/file", handler: apiCatalogFile },
  { method: "POST", path: "/api/catalog/file/save", handler: apiCatalogFileSave },
];

module.exports = { catalogRoutes };

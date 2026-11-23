// @ts-check
const { apiFeatures } = require("../controllers/features.controller");

const featuresRoutes = [
  { method: "GET", path: "/api/features", handler: apiFeatures },
];

module.exports = { featuresRoutes };

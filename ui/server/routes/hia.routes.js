// @ts-check
const { apiHiaMetrics } = require("../controllers/hia.controller");

const hiaRoutes = [
  { method: "GET", path: "/api/hia/metrics", handler: apiHiaMetrics },
];

module.exports = { hiaRoutes };

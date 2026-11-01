// @ts-check
const {
  apiCanvasBoardsList,
  apiCanvasBoardCreate,
  apiCanvasBoardGet,
  apiCanvasBoardUpdate,
  apiCanvasBoardDelete,
} = require("../controllers/canvas.controller");

// Ids are captured loosely on purpose: canvas-validate rejects malformed ids
// with 400 INVALID_ID instead of letting them fall through to a 404.
const ITEM_PATH = /^\/api\/canvas\/boards\/([^/]+)$/;

const canvasRoutes = [
  { method: "GET", path: "/api/canvas/boards", handler: apiCanvasBoardsList },
  { method: "POST", path: "/api/canvas/boards", handler: apiCanvasBoardCreate },
  { method: "GET", path: ITEM_PATH, handler: apiCanvasBoardGet },
  { method: "PUT", path: ITEM_PATH, handler: apiCanvasBoardUpdate },
  { method: "DELETE", path: ITEM_PATH, handler: apiCanvasBoardDelete },
];

module.exports = { canvasRoutes };

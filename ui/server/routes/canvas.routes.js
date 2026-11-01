// @ts-check
const {
  apiCanvasBoardsList,
  apiCanvasBoardCreate,
  apiCanvasBoardGet,
  apiCanvasBoardUpdate,
  apiCanvasBoardDelete,
} = require("../controllers/canvas.controller");
const {
  apiCanvasAssetUpload,
  apiCanvasAssetGet,
} = require("../controllers/canvas-assets.controller");

// Ids are captured loosely on purpose: canvas-validate rejects malformed ids
// with 400 INVALID_ID instead of letting them fall through to a 404.
const ITEM_PATH = /^\/api\/canvas\/boards\/([^/]+)$/;
const ASSET_COLLECTION_PATH = /^\/api\/canvas\/boards\/([^/]+)\/assets$/;
const ASSET_ITEM_PATH = /^\/api\/canvas\/boards\/([^/]+)\/assets\/([^/]+)$/;

const canvasRoutes = [
  { method: "GET", path: "/api/canvas/boards", handler: apiCanvasBoardsList },
  { method: "POST", path: "/api/canvas/boards", handler: apiCanvasBoardCreate },
  // Asset routes come first: a board id must never swallow /assets/... as an item.
  { method: "POST", path: ASSET_COLLECTION_PATH, handler: apiCanvasAssetUpload },
  { method: "GET", path: ASSET_ITEM_PATH, handler: apiCanvasAssetGet },
  { method: "GET", path: ITEM_PATH, handler: apiCanvasBoardGet },
  { method: "PUT", path: ITEM_PATH, handler: apiCanvasBoardUpdate },
  { method: "DELETE", path: ITEM_PATH, handler: apiCanvasBoardDelete },
];

module.exports = { canvasRoutes };

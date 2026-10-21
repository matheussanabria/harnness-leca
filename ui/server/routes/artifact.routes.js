// @ts-check
const { apiProjectArtifacts } = require("../controllers/artifact.controller");
const { apiProjectArtifactsImport } = require("../controllers/artifact-import.controller");
const { apiProjectArtifactsAccess } = require("../controllers/artifact-access.controller");
const { apiProjectArtifactsPreview } = require("../controllers/artifact-preview.controller");
const {
  apiProjectArtifactsRelationships,
  apiProjectArtifactsRelationshipsUpdate,
} = require("../controllers/artifact-relationships.controller");

const artifactRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/artifacts$/, handler: apiProjectArtifacts },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/artifacts\/import$/, handler: apiProjectArtifactsImport },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/artifacts\/access$/, handler: apiProjectArtifactsAccess },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/artifacts\/preview$/, handler: apiProjectArtifactsPreview },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/artifacts\/relationships$/, handler: apiProjectArtifactsRelationships },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/artifacts\/relationships$/, handler: apiProjectArtifactsRelationshipsUpdate },
];

module.exports = { artifactRoutes };

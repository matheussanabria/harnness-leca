// @ts-check
const { apiArtifactPreview, apiArtifactReassign, apiArtifactCopy, apiArtifactUndo } = require("../controllers/artifact-ownership.controller");

const ID = "(art_[0-9A-HJKMNP-TV-Z]{26})";

const artifactOwnershipRoutes = [
  { method: "POST", path: new RegExp(`^/api/artifacts/${ID}/preview$`), handler: apiArtifactPreview },
  { method: "POST", path: new RegExp(`^/api/artifacts/${ID}/reassign$`), handler: apiArtifactReassign },
  { method: "POST", path: new RegExp(`^/api/artifacts/${ID}/copy$`), handler: apiArtifactCopy },
  { method: "POST", path: new RegExp(`^/api/artifacts/${ID}/undo$`), handler: apiArtifactUndo },
];

module.exports = { artifactOwnershipRoutes };

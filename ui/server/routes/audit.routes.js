// @ts-check
// Rotas da auditoria com evidencias (EP-11.01).
const {
  apiProjectAuditMatrix,
  apiProjectAuditEvidence,
  apiProjectAuditSummary,
  apiProjectAuditComponents,
  apiProjectAuditEvidenceSave,
} = require("../controllers/audit.controller");
const {
  apiProjectAuditPipeline,
  apiProjectAuditEvidenceGenerate,
  apiProjectAuditEvidenceExecute,
  apiProjectAuditEvidenceApprove,
} = require("../controllers/audit-pipeline.controller");

const auditRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/audit\/matrix$/, handler: apiProjectAuditMatrix },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/audit\/evidence$/, handler: apiProjectAuditEvidence },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/audit\/summary$/, handler: apiProjectAuditSummary },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/audit\/components$/, handler: apiProjectAuditComponents },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/audit\/pipeline$/, handler: apiProjectAuditPipeline },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/audit\/evidence$/, handler: apiProjectAuditEvidenceSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/audit\/evidence\/generate$/, handler: apiProjectAuditEvidenceGenerate },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/audit\/evidence\/execute$/, handler: apiProjectAuditEvidenceExecute },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/audit\/evidence\/approve$/, handler: apiProjectAuditEvidenceApprove },
];

module.exports = { auditRoutes };

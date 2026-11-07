// @ts-check
const {
  apiProjectSkillsGet,
  apiProjectSkillsTemplates,
  apiProjectSkillsRecognized,
  apiProjectSkillsDetail,
  apiProjectSkillsSave,
  apiProjectSkillsInstall,
  apiProjectSkillsImportRecognized,
  apiProjectSkillsDelete,
} = require("../controllers/skills.controller");

const projectSkillsRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills$/, handler: apiProjectSkillsGet },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/templates$/, handler: apiProjectSkillsTemplates },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/recognized$/, handler: apiProjectSkillsRecognized },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skills\/detail$/, handler: apiProjectSkillsDetail },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills$/, handler: apiProjectSkillsSave },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/install$/, handler: apiProjectSkillsInstall },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/import-recognized$/, handler: apiProjectSkillsImportRecognized },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skills\/delete$/, handler: apiProjectSkillsDelete },
];

module.exports = { projectSkillsRoutes };

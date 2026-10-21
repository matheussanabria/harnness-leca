// @ts-check
const {
  apiProjectSkillBindings,
  apiProjectSkillBindingsUpdate,
} = require("../controllers/skill-bindings.controller");

const skillBindingRoutes = [
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/skill-bindings$/, handler: apiProjectSkillBindings },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/skill-bindings$/, handler: apiProjectSkillBindingsUpdate },
];

module.exports = { skillBindingRoutes };

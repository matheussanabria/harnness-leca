// @ts-check
// Instalação de templates (individuais ou pacotes) em um alvo.
const { findProjectTargets } = require("./targets");
const { saveSkill } = require("./writer");
const { WEB_TEMPLATES } = require("./catalog-web");
const { API_TEMPLATES } = require("./catalog-api");

/** Catálogo de templates padrão para Web e API */
const TEMPLATES_CATALOG = { web: WEB_TEMPLATES, api: API_TEMPLATES };

/**
 * Instala um template ou pacote de templates em um alvo
 */
function installTemplate(slug, targetId, templateName, customOptions = {}) {
  const targets = findProjectTargets(slug);
  const target = targets.find((t) => t.id === targetId);
  if (!target) throw new Error("Alvo não encontrado");

  // Instalação de pacote completo (bundle)
  if (templateName === "bundle:web" || templateName === "bundle:api") {
    const kind = templateName === "bundle:web" ? "web" : "api";
    const templates = TEMPLATES_CATALOG[kind];
    const installed = [];
    for (const t of templates) {
      saveSkill(slug, targetId, t.name, {
        content: t.templateMd,
        references: t.references,
      });
      installed.push(t.name);
    }
    return { ok: true, installed };
  }

  // Instalação de template individual
  let found = null;
  for (const list of Object.values(TEMPLATES_CATALOG)) {
    const item = list.find((x) => x.name === templateName);
    if (item) {
      found = item;
      break;
    }
  }

  if (!found) {
    throw new Error(`Template "${templateName}" não encontrado.`);
  }

  const skill = saveSkill(slug, targetId, found.name, {
    content: customOptions.content || found.templateMd,
    references: customOptions.references || found.references,
  });

  return { ok: true, skill };
}

module.exports = { installTemplate, TEMPLATES_CATALOG };

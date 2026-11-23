// @ts-check
// Feature manifest (EP-25.01, ADR-019): one entry per user-navigable feature.
// Routes are the real page paths (static.controller.js) or an office window id (window-registry.js).
const { validateManifest } = require("./validate");

/** @type {import("./validate").Feature[]} */
const FEATURES = [
  // --- scope "optional": works alone, improves with a project ---
  { id: "chat", titulo: "Chat universal", escopo: "optional", icone: "fa-solid fa-comments",
    rota: "/escritorio#chat", janela: "chat", artefatos: ["conversa"] },
  { id: "diario", titulo: "Diario de atividade", escopo: "optional", icone: "fa-solid fa-book",
    rota: "/diario", janela: "diario", artefatos: [] },

  // --- scope "project": meaningless without one ---
  { id: "scrum", titulo: "Scrum e sprints", escopo: "project", icone: "fa-solid fa-list-check",
    rota: "/escritorio#scrum", janela: "scrum", artefatos: ["historia", "sprint"] },
  { id: "studio", titulo: "Studio e preview", escopo: "project", icone: "fa-solid fa-pen-ruler",
    rota: "/escritorio#studio", janela: "studio", artefatos: ["prototipo"] },
  { id: "revisao", titulo: "Revisao e qualidade", escopo: "project", icone: "fa-solid fa-clipboard-check",
    rota: "/escritorio#review", janela: "review", artefatos: [] },
  { id: "deploy", titulo: "Deploy de projetos", escopo: "project", icone: "fa-solid fa-rocket",
    rota: "/deploy", janela: "datacenter", artefatos: [] },

  // --- scope "global": never needs a project ---
  { id: "escritorio", titulo: "Escritorio virtual", escopo: "global", icone: "fa-solid fa-building",
    rota: "/escritorio", janela: "office", artefatos: [] },
  { id: "visao-geral", titulo: "Visao geral dos projetos", escopo: "global", icone: "fa-solid fa-table-columns",
    rota: "/overview", janela: "overview", artefatos: [] },
  { id: "orquestracao", titulo: "Central de orquestracao", escopo: "global", icone: "fa-solid fa-diagram-project",
    rota: "/escritorio#orchestration", janela: "orchestration", artefatos: [] },
  { id: "consumo", titulo: "Consumo", escopo: "global", icone: "fa-solid fa-gauge-high",
    rota: "/consumo", janela: "consumo", artefatos: [] },
  { id: "catalogo", titulo: "Catalogo de skills e agentes", escopo: "global", icone: "fa-solid fa-book-open",
    rota: "/catalogo", janela: "catalogo", artefatos: [] },
];

const errors = validateManifest(FEATURES);
if (errors.length) throw new Error(`Invalid feature manifest:\n- ${errors.join("\n- ")}`);

/**
 * Adds availability for a scope: project-scope features need a project, the others never do.
 * @param {import("./validate").Feature[]} features
 * @param {string|null} projectSlug
 */
function availability(features, projectSlug) {
  return features.map((f) => {
    const needsProject = f.escopo === "project" && !projectSlug;
    return {
      ...f,
      disponivel: !needsProject,
      motivo: needsProject ? "Escolha um projeto para usar esta funcionalidade." : "",
    };
  });
}

module.exports = { FEATURES, availability };

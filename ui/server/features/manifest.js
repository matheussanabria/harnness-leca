// @ts-check
// Feature manifest (EP-25.01, ADR-019): one entry per user-navigable feature.
// Routes are the real page paths (static.controller.js) or an office window id (window-registry.js).
// estado "planejada": listed by the launcher as "em breve" until its story ships (Atelier: EP-25.10).
// escopoNaUrl: the launcher appends ?p=<project or _pessoal> so the SPA opens in the chosen scope (EP-25.12).
const { validateManifest } = require("./validate");

/** @type {import("./validate").Feature[]} */
const FEATURES = [
  // --- scope "optional": works alone, improves with a project ---
  { id: "chat", titulo: "Chat universal", escopo: "optional", icone: "fa-solid fa-comments",
    rota: "/escritorio#chat", janela: "chat", artefatos: ["conversa"],
    descricao: "Converse com os agentes, com ou sem projeto." },
  { id: "atelie", titulo: "Ateliê", escopo: "optional", icone: "fa-solid fa-wand-magic-sparkles",
    rota: "/atelie", janela: "atelie", artefatos: ["prototipo"], estado: "planejada", // EP-25.10
    descricao: "Crie e ajuste protótipos de tela com ajuda dos agentes." },
  { id: "mapa-mental", titulo: "Mapa mental", escopo: "optional", icone: "fa-solid fa-sitemap",
    rota: "/mapa-mental", janela: "mapa-mental", artefatos: ["canvas.mindmap"], escopoNaUrl: true,
    descricao: "Organize ideias em um mapa que você expande aos poucos." },
  { id: "quadro-livre", titulo: "Quadro livre", escopo: "optional", icone: "fa-solid fa-chalkboard",
    rota: "/quadro-livre", janela: "quadro-livre", artefatos: ["canvas.board"], escopoNaUrl: true,
    descricao: "Tela livre para esboçar, colar imagens e anotar." },
  { id: "diagramas", titulo: "Diagramas", escopo: "optional", icone: "fa-solid fa-share-nodes",
    rota: "/diagramas", janela: "diagramas", artefatos: ["canvas.diagram", "canvas.flow"], escopoNaUrl: true,
    descricao: "Fluxos, sequências e ER escritos em Mermaid, com preview." },
  { id: "diario", titulo: "Diário de atividade", escopo: "optional", icone: "fa-solid fa-book",
    rota: "/diario", janela: "diario", artefatos: [],
    descricao: "O que aconteceu e quando, por projeto ou geral." },

  // --- scope "project": meaningless without one ---
  { id: "scrum", titulo: "Scrum e sprints", escopo: "project", icone: "fa-solid fa-list-check",
    rota: "/escritorio#scrum", janela: "scrum", artefatos: ["historia", "sprint"],
    descricao: "Quadro, histórias e sprints do projeto." },
  { id: "studio", titulo: "Studio e preview", escopo: "project", icone: "fa-solid fa-pen-ruler",
    rota: "/escritorio#studio", janela: "studio", artefatos: ["prototipo"],
    descricao: "Código, protótipos e preview do projeto." },
  { id: "revisao", titulo: "Revisão e qualidade", escopo: "project", icone: "fa-solid fa-clipboard-check",
    rota: "/escritorio#review", janela: "review", artefatos: [],
    descricao: "Revise entregas e confira a qualidade." },
  { id: "deploy", titulo: "Deploy de projetos", escopo: "project", icone: "fa-solid fa-rocket",
    rota: "/deploy", janela: "datacenter", artefatos: [],
    descricao: "Publique e acompanhe os ambientes." },

  // --- scope "global": never needs a project ---
  { id: "escritorio", titulo: "Escritório virtual", escopo: "global", icone: "fa-solid fa-building",
    rota: "/escritorio", janela: "office", artefatos: [],
    descricao: "Veja os agentes trabalhando." },
  { id: "visao-geral", titulo: "Visão geral dos projetos", escopo: "global", icone: "fa-solid fa-table-columns",
    rota: "/overview", janela: "overview", artefatos: [],
    descricao: "Todos os projetos em uma tela." },
  { id: "orquestracao", titulo: "Central de orquestração", escopo: "global", icone: "fa-solid fa-diagram-project",
    rota: "/escritorio#orchestration", janela: "orchestration", artefatos: [],
    descricao: "Sessões e execuções em andamento." },
  { id: "consumo", titulo: "Consumo", escopo: "global", icone: "fa-solid fa-gauge-high",
    rota: "/consumo", janela: "consumo", artefatos: [],
    descricao: "Uso de tokens e custo por motor." },
  { id: "catalogo", titulo: "Catálogo de skills e agentes", escopo: "global", icone: "fa-solid fa-book-open",
    rota: "/catalogo", janela: "catalogo", artefatos: [],
    descricao: "Skills, agentes e workflows disponíveis." },
];

const errors = validateManifest(FEATURES);
if (errors.length) throw new Error(`Invalid feature manifest:\n- ${errors.join("\n- ")}`);

/**
 * Adds availability for a scope: project-scope features need a project, planned ones are "em breve",
 * everything else never needs one.
 * @param {import("./validate").Feature[]} features
 * @param {string|null} projectSlug
 */
function availability(features, projectSlug) {
  return features.map((f) => {
    const estado = f.estado || "ativa";
    const planned = estado === "planejada";
    const needsProject = f.escopo === "project" && !projectSlug;
    return {
      ...f,
      estado,
      disponivel: !planned && !needsProject,
      motivo: planned ? "Em breve." : needsProject ? "Escolha um projeto para usar esta funcionalidade." : "",
    };
  });
}

module.exports = { FEATURES, availability };

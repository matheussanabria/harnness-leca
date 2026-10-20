// @ts-check
/**
 * Catálogo imutável dos templates canônicos de workspace.
 * IDs legados são preservados para compatibilidade com a EP-01.10.
 */

import { SCHEMA_VERSION } from "./layout-persistence.js";

export const WORKSPACE_TEMPLATE_IDS = Object.freeze({
  development: "dev",
  planning: "scrum",
  quality: "quality",
  operations: "ops"
});

/** @param {any} template */
function defineTemplate(template) {
  template.layout.windows.forEach((win) => {
    Object.freeze(win.bounds);
    Object.freeze(win);
  });
  Object.freeze(template.layout.windows);
  Object.freeze(template.layout);
  return Object.freeze(template);
}

export const SYSTEM_WORKSPACES = Object.freeze([
  defineTemplate({
    id: WORKSPACE_TEMPLATE_IDS.development,
    templateKey: "development",
    name: "Desenvolvimento",
    icon: "fa-solid fa-code",
    description: "Codex e Studio para implementação, preview e validação técnica",
    isSystem: true,
    layout: {
      _v: SCHEMA_VERSION, updatedAt: 0, projectId: "system", activeWindowId: "win-codex",
      windows: [
        { id: "win-codex", moduleId: "codex", presentation: "floating", visibility: "visible", bounds: { x: 40, y: 70, width: 540, height: 600 }, isFocused: true },
        { id: "win-studio", moduleId: "studio", presentation: "floating", visibility: "visible", bounds: { x: 600, y: 70, width: 780, height: 600 }, isFocused: false }
      ]
    }
  }),
  defineTemplate({
    id: WORKSPACE_TEMPLATE_IDS.planning,
    templateKey: "planning",
    name: "Planejamento",
    icon: "fa-solid fa-table-columns",
    description: "Scrum e Diário para organizar histórias, sprints e decisões",
    isSystem: true,
    layout: {
      _v: SCHEMA_VERSION, updatedAt: 0, projectId: "system", activeWindowId: "win-scrum",
      windows: [
        { id: "win-scrum", moduleId: "scrum", presentation: "floating", visibility: "visible", bounds: { x: 50, y: 70, width: 780, height: 620 }, isFocused: true },
        { id: "win-diario", moduleId: "diario", presentation: "floating", visibility: "visible", bounds: { x: 850, y: 70, width: 530, height: 620 }, isFocused: false }
      ]
    }
  }),
  defineTemplate({
    id: WORKSPACE_TEMPLATE_IDS.quality,
    templateKey: "quality",
    name: "Qualidade",
    icon: "fa-solid fa-clipboard-check",
    description: "Revisão e Studio para auditoria, testes e inspeção de entregas",
    isSystem: true,
    layout: {
      _v: SCHEMA_VERSION, updatedAt: 0, projectId: "system", activeWindowId: "win-review",
      windows: [
        { id: "win-review", moduleId: "review", presentation: "floating", visibility: "visible", bounds: { x: 50, y: 70, width: 560, height: 600 }, isFocused: true },
        { id: "win-studio", moduleId: "studio", presentation: "floating", visibility: "visible", bounds: { x: 630, y: 70, width: 750, height: 600 }, isFocused: false }
      ]
    }
  }),
  defineTemplate({
    id: WORKSPACE_TEMPLATE_IDS.operations,
    templateKey: "operations",
    name: "Operações",
    icon: "fa-solid fa-server",
    description: "Datacenter e Orquestração para serviços, execuções e deploys",
    isSystem: true,
    layout: {
      _v: SCHEMA_VERSION, updatedAt: 0, projectId: "system", activeWindowId: "win-datacenter",
      windows: [
        { id: "win-datacenter", moduleId: "datacenter", presentation: "floating", visibility: "visible", bounds: { x: 50, y: 70, width: 660, height: 590 }, isFocused: true },
        { id: "win-orchestration", moduleId: "orchestration", presentation: "floating", visibility: "visible", bounds: { x: 730, y: 70, width: 650, height: 590 }, isFocused: false }
      ]
    }
  })
]);

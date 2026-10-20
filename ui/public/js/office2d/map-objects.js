// @ts-check
// DAI HQ — Catálogo e Coordenadas de Móveis e Zonas da Grade Isométrica (12x10)
// Integrado ao Catálogo Canônico de Objetos (EP-03.01) com ícones FontAwesome exclusivos (sem emojis).

import { getOfficeObjectsFor2D } from "../office/office-object-catalog.js";

export const DEFAULT_GRID_CONFIG = {
  gridW: 12,
  gridH: 10,
  tileW: 64,
  tileH: 32
};

/**
 * Constrói a lista de objetos 2D a partir do catálogo canônico,
 * preservando IDs legados para compatibilidade com o renderizador de móveis.
 */
function build2DObjects() {
  const canonicalItems = getOfficeObjectsFor2D();
  
  // Mapa de remapeamento de ID para retrocompatibilidade de renderização de sprites/móveis
  /** @type {Record<string, string>} */
  const legacyIdMap = {
    codex_station: "codex_desk",
    claude_station: "claude_desk",
    gemini_station: "gemini_desk",
    opencode_station: "opencode_desk",
    war_room_table_console: "meeting_table",
    lounge_couch: "sofa"
  };

  /** @type {Array<{ id: string, name: string, gx: number, gy: number, gz: number, w: number, h: number, icon: string, category: string }>} */
  const list = [];

  for (const item of canonicalItems) {
    const renderedId = legacyIdMap[item.id] || item.id;
    list.push({
      ...item,
      id: renderedId
    });
  }

  // Elementos puramente decorativos sem interação direta
  list.push({
    id: "plant",
    name: "Monstera Deliciosa (Biofilia)",
    gx: 1,
    gy: 1,
    gz: 0,
    w: 1,
    h: 1,
    icon: "fa-solid fa-seedling",
    category: "deco"
  });

  return list;
}

export const OFFICE_2D_OBJECTS = build2DObjects();

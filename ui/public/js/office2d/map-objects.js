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
 * Constrói a lista de objetos 2D a partir do catálogo canônico.
 * O modo 2.5D compartilha os mesmos IDs do 3D; aliases legados ficam no renderizador.
 */
function build2DObjects() {
  const canonicalItems = getOfficeObjectsFor2D();

  /** @type {Array<{ id: string, name: string, gx: number, gy: number, gz: number, w: number, h: number, icon: string, category: string }>} */
  const list = [];

  for (const item of canonicalItems) {
    list.push({ ...item });
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

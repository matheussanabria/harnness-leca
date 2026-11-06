// @ts-check
/**
 * Catálogo Canônico de Objetos Interativos do Escritório 2.5D e 3D (EP-03.01)
 * Responsabilidade Única: Prover a fonte única de verdade dos objetos interativos,
 * metadados, ícones FontAwesome exclusivos, vínculos com WindowManager e coordenadas.
 */

import { STATIONS_DATA } from "./catalog/stations.data.js";
import { FACILITIES_DATA } from "./catalog/facilities.data.js";

/**
 * @typedef {Object} OfficeObjectDescriptor
 * @property {string} id Identificador canônico único
 * @property {string} name Nome legível
 * @property {"workstation" | "agent_station" | "collaboration" | "infrastructure" | "lounge"} category
 * @property {string} badge Rótulo curto para crachás e HUD
 * @property {string} badgeColor Cor hexadecimal
 * @property {string} icon Classe de ícone FontAwesome (fa-solid ...)
 * @property {string} label Rótulo do tooltip/prompt
 * @property {string} sub Descrição complementar
 * @property {string} keyHint Tecla de atalho (ex: "E")
 * @property {"window" | "drawer" | "seat" | "screen_focus" | "custom"} actionType
 * @property {string | null} [moduleId] Identificador do módulo no Window Manager (se aplicável)
 * @property {Record<string, string>} [moduleByPreset] Módulo alternativo por preset de tela ativo (ex.: telão em "kanban" abre "scrum")
 * @property {number} [distance] Raio de proximidade em unidades 3D
 * @property {number} [offsetY] Elevação vertical do marcador 3D
 * @property {{ x?: number, y?: number, z?: number, dynamic?: string }} [position3D]
 * @property {{ gx: number, gy: number, gz: number, w: number, h: number }} [position2D]
 * @property {string[]} [aliases] Identificadores legados ou alternativos
 */

/** @type {OfficeObjectDescriptor[]} */
export const OFFICE_OBJECT_CATALOG = Object.freeze([
  ...STATIONS_DATA,
  ...FACILITIES_DATA
]);

/**
 * Mapeamento indexado rápido de id/aliases para o descritor canônico
 * @type {Map<string, OfficeObjectDescriptor>}
 */
const objectIndex = new Map();
for (const item of OFFICE_OBJECT_CATALOG) {
  objectIndex.set(item.id, item);
  if (Array.isArray(item.aliases)) {
    for (const alias of item.aliases) {
      objectIndex.set(alias, item);
    }
  }
}

/**
 * Resolve o objeto canônico a partir do ID ou de um alias
 * @param {string} idOrAlias
 * @returns {OfficeObjectDescriptor | undefined}
 */
export function getOfficeObject(idOrAlias) {
  if (!idOrAlias || typeof idOrAlias !== "string") return undefined;
  return objectIndex.get(idOrAlias);
}

/**
 * Resolve o ID canônico de um objeto ou alias
 * @param {string} idOrAlias
 * @returns {string}
 */
export function resolveObjectId(idOrAlias) {
  const obj = getOfficeObject(idOrAlias);
  return obj ? obj.id : idOrAlias;
}

/**
 * Lista todos os objetos do catálogo, opcionalmente filtrados por categoria ou modo
 * @param {{ category?: string, has2D?: boolean, has3D?: boolean }} [filter]
 * @returns {OfficeObjectDescriptor[]}
 */
export function listOfficeObjects(filter = {}) {
  return OFFICE_OBJECT_CATALOG.filter(obj => {
    if (filter.category && obj.category !== filter.category) return false;
    if (filter.has2D && !obj.position2D) return false;
    if (filter.has3D && !obj.position3D) return false;
    return true;
  });
}

/**
 * Extrai a lista de objetos formatada para o motor 2D isométrico
 * @returns {Array<{ id: string, name: string, gx: number, gy: number, gz: number, w: number, h: number, icon: string, category: string }>}
 */
export function getOfficeObjectsFor2D() {
  return OFFICE_OBJECT_CATALOG
    .filter(obj => !!obj.position2D)
    .map(obj => ({
      id: obj.id,
      name: obj.name,
      // @ts-ignore
      gx: obj.position2D.gx,
      // @ts-ignore
      gy: obj.position2D.gy,
      // @ts-ignore
      gz: obj.position2D.gz,
      // @ts-ignore
      w: obj.position2D.w,
      // @ts-ignore
      h: obj.position2D.h,
      icon: obj.icon,
      category: obj.category
    }));
}

/**
 * Extrai os objetos com metadados e raio para o motor 3D
 * @returns {OfficeObjectDescriptor[]}
 */
export function getOfficeObjectsFor3D() {
  return OFFICE_OBJECT_CATALOG.filter(obj => !!obj.position3D);
}

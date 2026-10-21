// @ts-check
// DAI HQ — Módulo de Iluminação Cênica do Escritório 3D (Three.js)
import { createLightingRig } from "./lighting-rig.js";

/**
 * Cria o rig de luzes cenográficas do estúdio e da Sala de Guerra.
 * Mantém a assinatura histórica e agora devolve o rig controlável (EP-03.06).
 * @param {any} scene
 * @param {any} THREE
 * @returns {import("./lighting-rig.js").OfficeLightingRig}
 */
export function setupOfficeLights(scene, THREE) {
  return createLightingRig(scene, THREE);
}

export { LIGHT_NAMES, OfficeLightingRig } from "./lighting-rig.js";

// @ts-check
// DAI HQ — Módulo de Registro de Hotspots e Interações Contextuais (3D)
// Integrado ao Catálogo Canônico de Objetos (EP-03.01) com ícones FontAwesome exclusivos.

import { getOfficeObjectsFor3D } from "../office/office-object-catalog.js";

/**
 * Registra todos os objetos interativos e postos operacionais do estúdio 3D
 * a partir do catálogo canônico de objetos
 * @param {any} manager InteractionManager
 * @param {any} THREE
 * @param {Object} context
 * @param {{ x: number, y: number, z: number }} context.chairPos
 * @param {{ x: number, y: number, z: number }} context.warChairPos
 * @param {Function} context.sitAtWorkstation
 * @param {Function} context.sitAtWarRoom
 * @param {Function} context.openWarRoomDrawer
 * @param {Function} context.openAgentDossier
 * @param {Function} context.toggleScreenFocus
 */
export function setupOfficeInteractions(manager, THREE, context) {
  const catalog3D = getOfficeObjectsFor3D();

  for (const item of catalog3D) {
    // 1. Resolve a posição 3D
    let position;
    if (item.position3D?.dynamic === "chairPos") {
      position = new THREE.Vector3(context.chairPos.x, context.chairPos.y, context.chairPos.z);
    } else if (item.position3D?.dynamic === "warChairPos") {
      position = new THREE.Vector3(context.warChairPos.x, context.warChairPos.y, context.warChairPos.z);
    } else if (item.position3D) {
      position = new THREE.Vector3(item.position3D.x || 0, item.position3D.y || 0, item.position3D.z || 0);
    } else {
      continue;
    }

    // 2. Resolve a ação correspondente
    /** @type {() => void} */
    let onInteract = () => {};

    if (item.id === "workstation_chair") {
      onInteract = () => context.sitAtWorkstation();
    } else if (item.id === "monitor_screen") {
      onInteract = () => context.toggleScreenFocus();
    } else if (item.id === "war_room_main_panel") {
      onInteract = () => context.openWarRoomDrawer("workflows");
    } else if (item.id === "war_room_user_chair") {
      onInteract = () => context.sitAtWarRoom();
    } else if (item.id === "war_room_table_console") {
      onInteract = () => context.openWarRoomDrawer("projects");
    } else if (item.id.endsWith("_station")) {
      const agentKey = item.moduleId || "gemini";
      onInteract = () => context.openAgentDossier(agentKey);
    } else if (item.id === "server_rack") {
      // @ts-ignore
      onInteract = () => (window.triggerObject ? window.triggerObject("server_rack") : null);
    } else if (item.id === "coffee_bar") {
      // @ts-ignore
      onInteract = () => (window.triggerObject ? window.triggerObject("coffee_bar") : null);
    } else if (item.id === "lounge_couch") {
      // @ts-ignore
      onInteract = () => (window.triggerObject ? window.triggerObject("sofa") : null);
    } else {
      // @ts-ignore
      onInteract = () => (window.triggerObject ? window.triggerObject(item.id) : null);
    }

    // 3. Monta o payload de registro
    const registration = {
      id: item.id,
      name: item.name,
      badge: item.badge,
      badgeColor: item.badgeColor,
      label: item.label,
      sub: item.sub,
      keyHint: item.keyHint || "E",
      offsetY: item.offsetY || 1.5,
      position,
      distance: item.distance || 2.0,
      onInteract
    };

    // Registra o item canônico
    manager.register(registration);

    // Registra aliases legados para suportar identificadores já embutidos nas malhas 3D
    if (Array.isArray(item.aliases)) {
      for (const alias of item.aliases) {
        manager.register({
          ...registration,
          id: alias
        });
      }
    }
  }
}

// @ts-check
// Abas físicas ao lado do telão da Sala de Guerra (EP-05.06).
import { WAR_SCREEN_TABS, normalizeWarScreenPreset } from "../../office/war-screen-tabs-model.js";
import { officeScreenPresets } from "../../office/office-screen-presets.js";
import { playClickSound } from "../../office-audio.js";

const TAB_WIDTH = 0.9;
const TAB_HEIGHT = 0.4;
const TAB_GAP = 0.09;
const TAB_DEPTH = 0.05;
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 176;

function shorten(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function createWarScreenTabTexture(THREE, tab, active) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = active ? "#0b3a52" : "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = active ? "#38bdf8" : "#334155";
  ctx.fillRect(0, 0, 12, canvas.height);

  ctx.strokeStyle = active ? "#38bdf8" : "#1e293b";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  ctx.fillStyle = active ? "#f8fafc" : "#cbd5e1";
  ctx.font = "bold 30px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(tab.label.toUpperCase(), 30, 58);

  ctx.fillStyle = active ? "#bae6fd" : "#64748b";
  ctx.font = "18px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(shorten(tab.description, 34), 30, 96);

  ctx.fillStyle = active ? "#22c55e" : "#475569";
  ctx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(active ? "PROJETANDO" : "SELECIONAR", 30, 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Monta a coluna de abas à direita do telão. A seleção é sempre explícita.
 * @param {Object} options
 * @param {any} options.THREE
 * @param {any} options.group
 * @param {any} options.interactionManager
 * @param {number} options.screenCenterX
 * @param {number} options.screenCenterY
 * @param {number} options.screenWidth
 * @param {number} options.screenZ
 * @param {(presetId: string) => void} [options.onSelect]
 */
export function createWarScreenTabs({
  THREE,
  group,
  interactionManager,
  screenCenterX,
  screenCenterY,
  screenWidth,
  screenZ,
  onSelect
}) {
  const totalHeight = WAR_SCREEN_TABS.length * TAB_HEIGHT + (WAR_SCREEN_TABS.length - 1) * TAB_GAP;
  const columnX = screenCenterX + screenWidth / 2 + 0.62;
  const columnZ = screenZ + 0.02;
  const startY = screenCenterY + totalHeight / 2 - TAB_HEIGHT / 2;
  const records = [];

  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(TAB_WIDTH + 0.14, totalHeight + 0.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x070c14, metalness: 0.8, roughness: 0.25 })
  );
  backplate.position.set(columnX, screenCenterY, columnZ - 0.03);
  group.add(backplate);

  let activeId = normalizeWarScreenPreset(officeScreenPresets.getPreset("war_room_main_panel"));

  function applyActive(presetId) {
    activeId = normalizeWarScreenPreset(presetId);
    for (const record of records) {
      const active = record.id === activeId;
      if (record.texture) record.texture.dispose();
      record.texture = createWarScreenTabTexture(THREE, record.tab, active);
      record.face.material.map = record.texture;
      record.face.material.needsUpdate = true;
      record.base.material.color.set(active ? 0x0e7490 : 0x0b1220);
      record.base.material.emissive?.set(active ? 0x0e7490 : 0x000000);
      record.base.material.emissiveIntensity = active ? 0.45 : 0;
    }
  }

  function select(presetId) {
    playClickSound();
    const normalized = normalizeWarScreenPreset(presetId);
    officeScreenPresets.setPreset("war_room_main_panel", normalized);
    applyActive(normalized);
    onSelect?.(normalized);
  }

  WAR_SCREEN_TABS.forEach((tab, index) => {
    const y = startY - index * (TAB_HEIGHT + TAB_GAP);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(TAB_WIDTH, TAB_HEIGHT, TAB_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.65, roughness: 0.3 })
    );
    base.position.set(columnX, y, columnZ);
    group.add(base);

    const texture = createWarScreenTabTexture(THREE, tab, tab.id === activeId);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(TAB_WIDTH - 0.06, TAB_HEIGHT - 0.06),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    face.position.set(columnX, y, columnZ + TAB_DEPTH / 2 + 0.006);
    face.name = `Aba ${tab.label}`;
    face.userData = { id: `war_screen_tab_${tab.id}`, name: face.name };
    group.add(face);

    records.push({ id: tab.id, tab, base, face, texture });

    interactionManager?.register({
      id: `war_screen_tab_${tab.id}`,
      name: face.name,
      label: `[E] ${tab.label}`,
      sub: "Selecionar projeção do telão",
      keyHint: "E",
      offsetY: TAB_HEIGHT / 2,
      position: new THREE.Vector3(columnX, y, columnZ),
      distance: 3.2,
      mesh: face,
      onInteract: () => select(tab.id)
    });
  });

  const unsubscribe = officeScreenPresets.subscribe(({ screenId, presetId }) => {
    if (screenId === "war_room_main_panel") applyActive(presetId);
  });

  return {
    element: backplate,
    getActive: () => activeId,
    select,
    setActive: applyActive,
    dispose() {
      unsubscribe();
      for (const record of records) {
        record.texture?.dispose();
        record.face.material?.dispose();
        record.base.material?.dispose();
      }
    }
  };
}

// @ts-check
/**
 * DAI HQ — Catálogo canônico dos modos de visualização do escritório (EP-03.07).
 * Responsabilidade única: traduzir aliases, descrever os modos e persistir a
 * preferência por projeto. Sem DOM, sem Three.js e sem ciclo de vida de motor.
 */

export const VIEW_MODES = ["3d", "diorama", "2.5d"];

export const CAMERA_MODES = [
  "third_person",
  "first_person",
  "workstation",
  "screen_focus",
  "war_room",
  "war_room_seated",
  "orbit"
];

export const DEFAULT_VIEW_MODE = "3d";
export const DEFAULT_CAMERA_MODE = "third_person";
export const VIEW_MODE_STORAGE_PREFIX = "dai_office_view_mode:";

export const VIEW_MODE_CATALOG = {
  "3d": {
    id: "3d",
    label: "3D",
    engine: "3d",
    icon: "fa-solid fa-cube",
    shortcut: "1",
    hint: '<i class="fa-solid fa-person-walking"></i> <b>WASD</b> Andar · <b>Alt/M</b> Cursor Livre · <b>1-4</b> Câmeras · <b>E</b> Interagir · <b>H</b> Menus'
  },
  diorama: {
    id: "diorama",
    label: "Diorama",
    engine: "3d",
    cameraMode: "orbit",
    icon: "fa-solid fa-globe",
    shortcut: "5",
    hint: '<i class="fa-solid fa-globe"></i> Diorama 360° · Arraste para orbitar · <b>1</b> Voltar ao 3D · <b>H</b> Menus'
  },
  "2.5d": {
    id: "2.5d",
    label: "Modo 2.5D",
    engine: "2.5d",
    icon: "fa-solid fa-layer-group",
    shortcut: "6",
    hint: '<i class="fa-solid fa-layer-group"></i> Ande com <b>WASD</b> · <b>E</b> Interagir · <b>1</b> Voltar ao 3D · <b>H</b> Menus'
  }
};

const VIEW_ALIASES = {
  "3d": "3d",
  "3": "3d",
  third_person: "3d",
  first_person: "3d",
  workstation: "3d",
  screen_focus: "3d",
  war_room: "3d",
  war_room_seated: "3d",
  diorama: "diorama",
  orbit: "diorama",
  "2d": "2.5d",
  "2.5d": "2.5d",
  isometric: "2.5d",
  iso: "2.5d"
};

/**
 * @param {unknown} value
 * @returns {string} um dos `VIEW_MODES`
 */
export function normalizeViewMode(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return VIEW_ALIASES[key] || DEFAULT_VIEW_MODE;
}

/**
 * @param {unknown} value
 * @returns {string} um dos `CAMERA_MODES`
 */
export function normalizeCameraMode(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return CAMERA_MODES.includes(key) ? key : DEFAULT_CAMERA_MODE;
}

/**
 * @param {unknown} value modo ou alias legado
 * @returns {{ id: string, label: string, engine: string, icon: string, shortcut: string, hint: string, cameraMode?: string }}
 */
export function resolveViewMode(value) {
  const mode = normalizeViewMode(value);
  const base = VIEW_MODE_CATALOG[mode];
  const key = String(value ?? "").trim().toLowerCase();
  const cameraMode = base.cameraMode || (CAMERA_MODES.includes(key) ? key : undefined);
  return { mode, ...base, ...(cameraMode ? { cameraMode } : {}) };
}

/**
 * Converte a câmera lógica para o valor aceito pelo `CameraController`.
 * @param {unknown} value
 * @returns {string}
 */
export function cameraModeForEngine(value) {
  const cameraMode = normalizeCameraMode(value);
  if (cameraMode === "war_room" || cameraMode === "war_room_seated") return "third_person";
  return cameraMode;
}

/**
 * @param {unknown} project
 * @returns {string}
 */
export function viewModeStorageKey(project) {
  const slug = String(project ?? "").trim() || "global";
  return `${VIEW_MODE_STORAGE_PREFIX}${slug}`;
}

/**
 * @param {{ getItem?: (key: string) => string | null } | null | undefined} storage
 * @param {unknown} project
 * @returns {{ mode: string, cameraMode: string } | null}
 */
export function readViewState(storage, project) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(viewModeStorageKey(project));
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const mode = normalizeViewMode(parsed?.mode ?? parsed);
    const cameraMode = normalizeCameraMode(parsed?.cameraMode);
    return { mode, cameraMode };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ setItem?: (key: string, value: string) => void } | null | undefined} storage
 * @param {unknown} project
 * @param {{ mode?: string, cameraMode?: string }} state
 * @returns {boolean}
 */
export function writeViewState(storage, project, state = {}) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    const mode = normalizeViewMode(state.mode);
    const cameraMode = normalizeCameraMode(state.cameraMode);
    storage.setItem(viewModeStorageKey(project), JSON.stringify({ mode, cameraMode }));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {{ removeItem?: (key: string) => void } | null | undefined} storage
 * @param {unknown} project
 * @returns {boolean}
 */
export function clearViewState(storage, project) {
  if (!storage || typeof storage.removeItem !== "function") return false;
  try {
    storage.removeItem(viewModeStorageKey(project));
    return true;
  } catch (_) {
    return false;
  }
}

// @ts-check
// Adoção do estado persistido do Mapa em Camadas (EP-14.09): tela, camada,
// campo em foco, filtro de rastreamento e viewport sobrevivem ao F5.
import { getScreenStateClient } from "../shared/screen-state.js";
import { dls } from "./design-layers-store.js";

export const LAYERS_SCREEN_ID = "layers";
export const LAYER_IDS = Object.freeze(["ui", "rules", "api", "data", "tests", "legacy"]);
export const LAYER_VIEWPORTS = Object.freeze(["desktop", "tablet", "mobile"]);

const text = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** Fotografia serializável do estado atual do Mapa em Camadas. */
export function layersStateFromStore() {
  return {
    activeScreen: text(dls.activeScreenId, 120),
    selectedLayer: LAYER_IDS.includes(dls.activeLayer) ? dls.activeLayer : "ui",
    focusedField: text(dls.focusedFieldId, 120),
    filterOnlyFocused: Boolean(dls.filterOnlyFocused),
    viewport: LAYER_VIEWPORTS.includes(dls.activeViewport) ? dls.activeViewport : "desktop",
  };
}

/** Aplica somente campos válidos e devolve `true` quando o store mudou. */
export function applyLayersState(state = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  let changed = false;
  const set = (key, value) => {
    if (dls[key] === value) return;
    dls[key] = value;
    changed = true;
  };

  if (own(state, "activeScreen") && text(state.activeScreen, 120)) set("activeScreenId", text(state.activeScreen, 120));
  if (own(state, "selectedLayer") && LAYER_IDS.includes(state.selectedLayer)) set("activeLayer", state.selectedLayer);
  if (own(state, "focusedField")) set("focusedFieldId", text(state.focusedField, 120) || null);
  if (typeof state.filterOnlyFocused === "boolean") set("filterOnlyFocused", state.filterOnlyFocused);
  if (own(state, "viewport") && LAYER_VIEWPORTS.includes(state.viewport)) set("activeViewport", state.viewport);
  return changed;
}

/**
 * Adaptador com hidratação única e persistência preservando ações anteriores à
 * chegada do estado do servidor.
 * @param {{ loadScreen: Function, patchScreen: Function }} client
 */
export function createLayersStateAdapter(client) {
  let hydrated = false;
  let hydration = null;
  let pending = null;

  async function hydrate() {
    if (hydrated) return false;
    if (hydration) return hydration;
    hydration = Promise.resolve()
      .then(() => client.loadScreen(LAYERS_SCREEN_ID))
      .catch(() => ({}))
      .then((loaded) => {
        let changed = applyLayersState(loaded);
        if (pending) changed = applyLayersState(pending) || changed;
        hydrated = true;
        hydration = null;
        return changed;
      });
    return hydration;
  }

  async function persist(patch) {
    const safe = patch && typeof patch === "object" ? patch : layersStateFromStore();
    applyLayersState(safe);
    pending = { ...(pending || {}), ...safe };
    await hydrate();
    const payload = layersStateFromStore();
    pending = null;
    try { return await client.patchScreen(LAYERS_SCREEN_ID, payload); } catch { return false; }
  }

  return { hydrate, persist, isHydrated: () => hydrated };
}

let defaultAdapter = null;
function adapter() {
  if (!defaultAdapter) defaultAdapter = createLayersStateAdapter(getScreenStateClient());
  return defaultAdapter;
}

export const hydrateLayersState = () => adapter().hydrate();
export const persistLayersState = (patch) => adapter().persist(patch);
export const isLayersStateHydrated = () => adapter().isHydrated();

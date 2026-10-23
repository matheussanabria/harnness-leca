// @ts-check
// Adoção do estado persistido da tela Scrum (EP-14.09): filtros, sprint, aba,
// seleção de história e ordenação sobrevivem ao F5.
import { getScreenStateClient } from "../shared/screen-state.js";
import { ds } from "./design-scrum-store.js";

export const SCRUM_SCREEN_ID = "scrum";
export const SCRUM_TABS = Object.freeze(["sprint", "backlog", "epics"]);

const LIMITS = Object.freeze({ sprint: 120, filter: 120, selectedStory: 120, tab: 32, epicFilter: 120, assigneeFilter: 120 });

const text = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** Fotografia serializável do estado atual do Scrum. */
export function scrumStateFromStore() {
  return {
    sprint: text(ds.selectedSprintFilter, LIMITS.sprint) || "active",
    filter: text(ds.currentSearchQuery, LIMITS.filter),
    selectedStory: text(ds.selectedStoryId, LIMITS.selectedStory),
    tab: SCRUM_TABS.includes(ds.currentScrumTab) ? ds.currentScrumTab : "sprint",
    epicFilter: text(ds.currentEpicFilter, LIMITS.epicFilter) || "all",
    assigneeFilter: text(ds.currentAssigneeFilter, LIMITS.assigneeFilter) || "all",
    onlyImpediments: Boolean(ds.onlyImpediments),
  };
}

/** Aplica somente campos válidos e devolve `true` quando o store mudou. */
export function applyScrumState(state = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  let changed = false;
  const set = (key, value) => {
    if (ds[key] === value) return;
    ds[key] = value;
    changed = true;
  };

  if (own(state, "sprint") && text(state.sprint, LIMITS.sprint)) set("selectedSprintFilter", text(state.sprint, LIMITS.sprint));
  if (own(state, "filter")) set("currentSearchQuery", text(state.filter, LIMITS.filter));
  if (own(state, "selectedStory")) set("selectedStoryId", text(state.selectedStory, LIMITS.selectedStory) || null);
  if (own(state, "tab") && SCRUM_TABS.includes(state.tab)) set("currentScrumTab", state.tab);
  if (own(state, "epicFilter") && text(state.epicFilter, LIMITS.epicFilter)) set("currentEpicFilter", text(state.epicFilter, LIMITS.epicFilter));
  if (own(state, "assigneeFilter") && text(state.assigneeFilter, LIMITS.assigneeFilter)) set("currentAssigneeFilter", text(state.assigneeFilter, LIMITS.assigneeFilter));
  if (typeof state.onlyImpediments === "boolean") set("onlyImpediments", state.onlyImpediments);
  return changed;
}

/**
 * Adaptador com hidratação única e persistência que preserva a ação do usuário
 * feita antes do estado do servidor chegar.
 * @param {{ loadScreen: Function, patchScreen: Function, logAction: Function }} client
 */
export function createScrumStateAdapter(client) {
  let hydrated = false;
  let hydration = null;
  let pending = null;

  async function hydrate() {
    if (hydrated) return false;
    if (hydration) return hydration;
    hydration = Promise.resolve()
      .then(() => client.loadScreen(SCRUM_SCREEN_ID))
      .catch(() => ({}))
      .then((loaded) => {
        let changed = applyScrumState(loaded);
        if (pending) changed = applyScrumState(pending) || changed;
        hydrated = true;
        hydration = null;
        return changed;
      });
    return hydration;
  }

  async function persist(patch) {
    const safe = patch && typeof patch === "object" ? patch : scrumStateFromStore();
    applyScrumState(safe);
    pending = { ...(pending || {}), ...safe };
    await hydrate();
    const payload = scrumStateFromStore();
    pending = null;
    try { return await client.patchScreen(SCRUM_SCREEN_ID, payload); } catch { return false; }
  }

  async function log(acao, alvo = "") {
    try { return await client.logAction(SCRUM_SCREEN_ID, acao, String(alvo).slice(0, 300)); } catch { return false; }
  }

  return { hydrate, persist, log, isHydrated: () => hydrated };
}

let defaultAdapter = null;
function adapter() {
  if (!defaultAdapter) defaultAdapter = createScrumStateAdapter(getScreenStateClient());
  return defaultAdapter;
}

export const hydrateScrumState = () => adapter().hydrate();
export const persistScrumState = (patch) => adapter().persist(patch);
export const logScrumAction = (acao, alvo = "") => adapter().log(acao, alvo);
export const isScrumStateHydrated = () => adapter().isHydrated();

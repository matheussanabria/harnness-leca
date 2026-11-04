// @ts-check
// DAI HQ - keeps the war screen in step with the Scrum data: refetches on an interval and when the tab regains focus.
// Fires the existing `dai:scrumChanged` event only when something the screen draws actually changed.

export const SCRUM_REFRESH_MS = 30000;

/**
 * Stable summary of what the war screen draws; equal signatures mean no redraw is needed.
 * @param {any} scrum
 * @returns {string}
 */
export function scrumSignature(scrum) {
  if (!scrum || typeof scrum !== "object") return "";
  const pick = (/** @type {any[]} */ list, /** @type {string[]} */ keys) => (Array.isArray(list) ? list : []).map((item) => keys.map((k) => item?.[k] ?? null));
  return JSON.stringify([
    scrum.activeSprintId ?? null,
    scrum.lanesRevision ?? null,
    pick(scrum.sprints, ["id", "name", "goal", "status"]),
    pick(scrum.lanes, ["id", "name", "order", "visible", "active"]),
    (Array.isArray(scrum.stories) ? scrum.stories : []).map((s) => [s.id, s.laneId, s.sprintId ?? null, s.title, s.points ?? null, Boolean(s.impediment?.active)]),
  ]);
}

/**
 * @param {{ activeProject: string, scrumData: any }} state
 * @param {{ fetchImpl?: typeof fetch, intervalMs?: number, doc?: Document, win?: Window }} [options]
 * @returns {{ refresh: () => Promise<boolean>, stop: () => void }}
 */
export function startScrumRefresh(state, options = {}) {
  const fetchImpl = options.fetchImpl || fetch.bind(globalThis);
  const doc = options.doc || document;
  const win = options.win || window;
  let busy = false;

  async function refresh() {
    const slug = state.activeProject;
    if (busy || !slug || doc.hidden) return false;
    busy = true;
    try {
      const res = await fetchImpl(`/api/project/${encodeURIComponent(slug)}/scrum`);
      if (!res.ok) return false;
      const scrum = (await res.json()).scrum;
      // The project may have been switched while the request was in flight: never apply stale data.
      if (!scrum || state.activeProject !== slug || scrumSignature(scrum) === scrumSignature(state.scrumData)) return false;
      state.scrumData = scrum;
      win.dispatchEvent(new CustomEvent("dai:scrumChanged", { detail: { slug, scrum } }));
      return true;
    } catch {
      return false;
    } finally {
      busy = false;
    }
  }

  const onVisible = () => { if (!doc.hidden) void refresh(); };
  const timer = setInterval(() => void refresh(), options.intervalMs || SCRUM_REFRESH_MS);
  doc.addEventListener("visibilitychange", onVisible);
  return { refresh, stop: () => { clearInterval(timer); doc.removeEventListener("visibilitychange", onVisible); } };
}

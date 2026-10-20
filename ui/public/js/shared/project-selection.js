// @ts-check

import { unsavedChanges } from "./unsaved-changes.js";

export const ACTIVE_PROJECT_STORAGE_KEY = "harness_active_project";
export const ACTIVE_PROJECT_EVENT = "harness:project-change";

export function normalizeProjectSlugs(projects = []) {
  return projects
    .map((project) => typeof project === "string" ? project : project?.slug)
    .filter((slug) => typeof slug === "string" && slug.trim())
    .map((slug) => slug.trim());
}

export function canonicalProjectSlug(projects, candidate) {
  if (!candidate || typeof candidate !== "string") return "";
  const wanted = candidate.trim().toLowerCase();
  return normalizeProjectSlugs(projects).find((slug) => slug.toLowerCase() === wanted) || "";
}

export function resolveInitialProject({ projects, urlProject, storedProject, serverActive }) {
  const slugs = normalizeProjectSlugs(projects);
  return canonicalProjectSlug(slugs, urlProject)
    || canonicalProjectSlug(slugs, storedProject)
    || canonicalProjectSlug(slugs, serverActive)
    || slugs[0]
    || "";
}

export class ProjectSelectionStore {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.storage = options.storage || globalThis.localStorage;
    this.location = options.location || globalThis.location;
    this.history = options.history || globalThis.history;
    this.eventTarget = options.eventTarget || globalThis.window;
    this.unsavedChanges = options.unsavedChanges || unsavedChanges;
    this.projects = [];
    this.activeProject = "";
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  configure(projects) {
    this.projects = normalizeProjectSlugs(projects);
    return this.projects;
  }

  async initialize({ projects, serverActive = "" }) {
    this.configure(projects);
    const serverSlug = canonicalProjectSlug(this.projects, serverActive);
    const selected = resolveInitialProject({
      projects: this.projects,
      urlProject: this.#readUrlProject(),
      storedProject: this.#readStoredProject(),
      serverActive: serverSlug,
    });
    if (!selected) return "";
    try {
      return await this.select(selected, { syncBackend: selected !== serverSlug, notify: false });
    } catch (error) {
      if (!serverSlug || selected === serverSlug) throw error;
      return this.select(serverSlug, { syncBackend: false, notify: false });
    }
  }

  async select(candidate, { syncBackend = true, notify = true, force = false } = {}) {
    const slug = canonicalProjectSlug(this.projects, candidate);
    if (!slug) throw new Error("Projeto inválido ou não encontrado.");
    const previous = this.activeProject;
    if (!force && previous && previous !== slug) {
      this.unsavedChanges.assertCanTransition({ projectSlug: previous });
    }
    if (syncBackend) await this.#syncBackend(slug);

    this.activeProject = slug;
    this.#persistBrowser(slug);
    if (notify && previous !== slug) this.#notify(slug, previous);
    return slug;
  }

  #readStoredProject() {
    try { return this.storage?.getItem(ACTIVE_PROJECT_STORAGE_KEY) || ""; } catch { return ""; }
  }

  #readUrlProject() {
    try { return new URL(this.location.href).searchParams.get("p") || ""; } catch { return ""; }
  }

  async #syncBackend(slug) {
    if (!this.fetchImpl) throw new Error("Sincronização do projeto ativo indisponível.");
    const response = await this.fetchImpl("/api/project/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Falha ao selecionar projeto (${response.status}).`);
    }
  }

  #persistBrowser(slug) {
    try { this.storage?.setItem(ACTIVE_PROJECT_STORAGE_KEY, slug); } catch {}
    try {
      const url = new URL(this.location.href);
      url.searchParams.set("p", slug);
      this.history?.replaceState({}, "", url.toString());
    } catch {}
  }

  #notify(slug, previous) {
    const detail = { slug, previous };
    this.listeners.forEach((listener) => listener(detail));
    try {
      if (typeof CustomEvent === "function") {
        this.eventTarget?.dispatchEvent(new CustomEvent(ACTIVE_PROJECT_EVENT, { detail }));
      }
    } catch {}
  }
}

export const projectSelection = new ProjectSelectionStore();

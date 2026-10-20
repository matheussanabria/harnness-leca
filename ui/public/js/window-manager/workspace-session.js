// @ts-check
/**
 * Sessao de layouts nomeados vinculada ao projeto ativo.
 * Responsabilidade unica: coordenar contexto, workspace ativo e eventos.
 */

/** @typedef {import("./workspace-presets.js").WorkspacePreset} WorkspacePreset */

export class WorkspaceSession {
  /**
   * @param {{
   *   listWorkspaces: (projectSlug: string) => WorkspacePreset[],
   *   saveWorkspace: (projectSlug: string, name: string, icon?: string) => WorkspacePreset | null,
   *   loadWorkspace: (projectSlug: string, workspaceId: string, viewport: { width: number, height: number }) => boolean,
   *   deleteWorkspace: (projectSlug: string, workspaceId: string) => boolean
   * }} presetManager
   * @param {{
   *   getProjectSlug?: () => string,
   *   getViewport?: () => { width: number, height: number },
   *   assertTransition?: (context: { projectSlug: string, workspaceId?: string }) => void
   * }} [options]
   */
  constructor(presetManager, options = {}) {
    this.presetManager = presetManager;
    this.getProjectSlug = options.getProjectSlug || (() => "");
    this.getViewport = options.getViewport || (() => ({ width: 1280, height: 720 }));
    this.assertTransition = options.assertTransition || (() => {});
    this.projectSlug = "";
    this.activeWorkspaceId = null;
    this.listeners = new Set();
  }

  /** @param {string} [projectSlug] */
  list(projectSlug) {
    const project = this.#resolveProject(projectSlug);
    return project ? this.presetManager.listWorkspaces(project) : [];
  }

  /**
   * @param {string} name
   * @param {string} [icon]
   * @param {string} [projectSlug]
   */
  save(name, icon, projectSlug) {
    const project = this.#resolveProject(projectSlug);
    if (!project) return null;
    const workspace = this.presetManager.saveWorkspace(project, name, icon);
    if (!workspace) return null;
    this.activeWorkspaceId = workspace.id;
    this.#notify();
    return workspace;
  }

  /**
   * @param {string} workspaceId
   * @param {{ width: number, height: number }} [viewport]
   * @param {string} [projectSlug]
   * @param {{ force?: boolean }} [options]
   */
  load(workspaceId, viewport, projectSlug, options = {}) {
    const project = this.#resolveProject(projectSlug);
    if (!project || !workspaceId) return false;
    const exists = this.presetManager.listWorkspaces(project)
      .some((workspace) => workspace.id === workspaceId);
    if (!exists) return false;
    if (!options.force) {
      this.assertTransition({ projectSlug: project, workspaceId: this.activeWorkspaceId || undefined });
    }
    const loaded = this.presetManager.loadWorkspace(
      project,
      workspaceId,
      viewport || this.getViewport()
    );
    if (!loaded) return false;
    this.activeWorkspaceId = workspaceId;
    this.#notify();
    return true;
  }

  /**
   * @param {string} workspaceId
   * @param {string} [projectSlug]
   */
  delete(workspaceId, projectSlug) {
    const project = this.#resolveProject(projectSlug);
    if (!project || !workspaceId) return false;
    const deleted = this.presetManager.deleteWorkspace(project, workspaceId);
    if (!deleted) return false;
    if (this.activeWorkspaceId === workspaceId) this.activeWorkspaceId = null;
    this.#notify();
    return true;
  }

  getState() {
    this.#resolveProject();
    return this.#snapshot();
  }

  #snapshot() {
    return {
      projectSlug: this.projectSlug,
      activeWorkspaceId: this.activeWorkspaceId,
      workspaces: this.projectSlug ? this.presetManager.listWorkspaces(this.projectSlug) : []
    };
  }

  /** @param {(state: ReturnType<WorkspaceSession["getState"]>) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @param {string} [candidate] */
  #resolveProject(candidate) {
    const project = typeof candidate === "string" ? candidate.trim() : this.getProjectSlug()?.trim();
    if (project !== this.projectSlug) {
      this.projectSlug = project || "";
      this.activeWorkspaceId = null;
    }
    return this.projectSlug;
  }

  #notify() {
    const state = this.#snapshot();
    this.listeners.forEach((listener) => listener(state));
  }
}

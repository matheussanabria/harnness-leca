// @ts-check
// Gerenciador de estado central do Escritório Virtual
import { projectSelection } from "./shared/project-selection.js";

export const officeState = {
  projects: [],
  activeProject: "",
  projectData: null,
  scrumData: null,
  engines: {},
  journal: [],
  activeAgents: {
    totalActive: 0,
    agents: {}
  },
  orchestrationState: null,
  orchestrationEvents: [],
  capabilities: null,
  eventSource: null,
  selectedObject: null,
  selectedEntity: null,
  isDrawerOpen: false,
  listeners: [],

  subscribe(fn) {
    this.listeners.push(fn);
  },

  notify() {
    this.listeners.forEach(fn => fn(this));
  },

  async init() {
    try {
      const stateRes = await fetch("/api/state");
      const state = await stateRes.json();
      const rawList = state.projects || [];
      this.projects = rawList.map(p => typeof p === "string" ? { slug: p, name: p } : p);
      
      this.activeProject = await projectSelection.initialize({
        projects: this.projects,
        serverActive: state.active,
      });

      await Promise.all([
        this.loadProjectData(this.activeProject),
        this.loadEngines(),
        this.loadActiveAgents(),
        this.loadCapabilities()
      ]);

      // Inicia stream de observabilidade em tempo real (SSE)
      this.initOrchestrationStream();

      // Polling de fallback a cada 10 segundos
      setInterval(() => {
        this.loadActiveAgents().then(() => this.notify());
      }, 10000);
    } catch (e) {
      console.error("[OfficeState] Erro ao carregar dados iniciais:", e);
    }
    this.notify();
  },

  initOrchestrationStream() {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
    }

    try {
      const url = `/api/orchestration/stream?projectId=${encodeURIComponent(this.activeProject || "")}`;
      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener("state", (e) => {
        try {
          const state = JSON.parse(e.data);
          this.orchestrationState = state;
          window.dispatchEvent(new CustomEvent("dai:orchestrationState", { detail: state }));
          this.notify();
        } catch {}
      });

      this.eventSource.addEventListener("event", (e) => {
        try {
          const evt = JSON.parse(e.data);
          this.orchestrationEvents.unshift(evt);
          if (this.orchestrationEvents.length > 100) this.orchestrationEvents.pop();
          window.dispatchEvent(new CustomEvent("dai:orchestrationEvent", { detail: evt }));
          this.notify();
        } catch {}
      });

      this.eventSource.onerror = () => {
        // O navegador reconecta automaticamente ao Server-Sent Events
      };
    } catch (err) {
      console.warn("[OfficeState] Falha ao iniciar stream SSE, mantendo polling:", err);
    }
  },

  async loadCapabilities() {
    try {
      const res = await fetch("/api/orchestration/capabilities");
      if (res.ok) {
        const data = await res.json();
        this.capabilities = data.capabilities;
      }
    } catch {}
  },

  async triggerOperation(action, target, parameters = {}) {
    try {
      const res = await fetch("/api/orchestration/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target, parameters })
      });
      return await res.json();
    } catch (err) {
      return { status: "failed", error: err.message };
    }
  },

  async loadActiveAgents() {
    try {
      const res = await fetch("/api/agents/active");
      if (res.ok) {
        this.activeAgents = await res.json();
      }
    } catch (e) {
      // Mantém os dados se houver falha temporária
    }
  },

  async setProject(slug) {
    if (!slug) return;
    try {
      const selected = await projectSelection.select(slug);
      if (this.activeProject === selected && this.projectData) return selected;
      this.activeProject = selected;
    } catch (error) {
      console.error("[OfficeState] Falha ao selecionar projeto:", error);
      return "";
    }

    await this.loadProjectData(this.activeProject);
    this.initOrchestrationStream();
    this.notify();
    return this.activeProject;
  },

  async setActiveProject(slug) {
    return this.setProject(slug);
  },

  async loadProjectData(slug) {
    if (!slug) return;
    try {
      const [projRes, journalRes, scrumRes] = await Promise.all([
        fetch(`/api/project/${encodeURIComponent(slug)}`),
        fetch(`/api/project/${encodeURIComponent(slug)}/journal`).catch(() => null),
        fetch(`/api/project/${encodeURIComponent(slug)}/scrum`).catch(() => null)
      ]);
      this.projectData = await projRes.json();
      if (journalRes && journalRes.ok) {
        this.journal = await journalRes.json();
      } else {
        this.journal = [];
      }
      if (scrumRes && scrumRes.ok) {
        const scrumPayload = await scrumRes.json();
        this.scrumData = scrumPayload.scrum || null;
      } else {
        this.scrumData = null;
      }
    } catch (e) {
      console.error(`[OfficeState] Falha ao carregar projeto ${slug}:`, e);
    }
  },

  async loadEngines() {
    try {
      const res = await fetch("/api/engines");
      this.engines = await res.json();
    } catch (e) {
      this.engines = {};
    }
  },

  selectObject(objKey) {
    this.selectedObject = objKey;
    this.isDrawerOpen = !!objKey;
    this.notify();
  },

  closeDrawer() {
    this.selectedObject = null;
    this.isDrawerOpen = false;
    this.notify();
  }
};

// @ts-check
// Estado compartilhado da tela de deploy (mutável, importado pelos módulos deploy-*).

export const dp = {
  deployConfig: {
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [],
  },
  // Estado de tela hidratado do servidor (EP-14.10); o histórico vem sempre da API.
  deployState: {
    environment: "",
    pipeline: "",
    config: null,
    selectedRun: "",
    tab: "",
  },
  deployHistory: [],
  availableProjects: [],
  // Estado dos modais
  activeEditProject: null,
  activeEditEnv: null,
  pendingConfirmAction: null,
};

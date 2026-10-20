// @ts-check
// Estado compartilhado da tela de deploy (mutável, importado pelos módulos deploy-*).

export const dp = {
  deployConfig: {
    easypanelHost: "",
    defaultTimeoutMs: 15000,
    projects: [],
  },
  deployHistory: [],
  availableProjects: [],
  // Estado dos modais
  activeEditProject: null,
  activeEditEnv: null,
  pendingConfirmAction: null,
};

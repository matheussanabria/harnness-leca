// @ts-check
/**
 * Registro de Módulos do Window Manager
 * Responsabilidade Única: Registrar, consultar e listar módulos que podem ser abertos em janelas.
 */

/** @typedef {import("../types/window-manager").ModuleDescriptor} ModuleDescriptor */

/** @type {Map<string, ModuleDescriptor>} */
const registry = new Map();

/**
 * Registra um descritor de módulo no catálogo de janelas
 * @param {ModuleDescriptor} descriptor
 */
export function registerModule(descriptor) {
  if (!descriptor || !descriptor.id) {
    throw new Error("Descritor de módulo inválido: campo 'id' obrigatório");
  }
  if (!descriptor.icon || typeof descriptor.icon !== "string") {
    throw new Error(`Módulo '${descriptor.id}' deve possuir ícone FontAwesome válido`);
  }
  registry.set(descriptor.id, {
    defaultPresentation: "floating",
    isSingleton: true,
    defaultBounds: { x: 80, y: 80, width: 640, height: 480 },
    minBounds: { width: 320, height: 240 },
    ...descriptor
  });
}

/**
 * Remove um módulo do catálogo
 * @param {string} moduleId
 */
export function unregisterModule(moduleId) {
  registry.delete(moduleId);
}

/**
 * Recupera um módulo registrado pelo identificador
 * @param {string} moduleId
 * @returns {ModuleDescriptor | undefined}
 */
export function getModule(moduleId) {
  return registry.get(moduleId);
}

/**
 * Lista todos os módulos registrados
 * @returns {ModuleDescriptor[]}
 */
export function listModules() {
  return Array.from(registry.values());
}

/**
 * Limpa todos os módulos registrados (útil para testes)
 */
export function clearRegistry() {
  registry.clear();
}

/**
 * Inicializa os módulos padrão do sistema com ícones FontAwesome exclusivos (sem emojis)
 */
export function registerDefaultModules() {
  const defaults = [
    {
      id: "gemini",
      title: "Estação Gemini",
      icon: "fa-solid fa-wand-magic-sparkles",
      defaultPresentation: /** @type {const} */ ("sidebar"),
      isSingleton: true,
      defaultBounds: { x: 100, y: 60, width: 520, height: 600 }
    },
    {
      id: "claude",
      title: "Estação Claude",
      icon: "fa-solid fa-terminal",
      defaultPresentation: /** @type {const} */ ("sidebar"),
      isSingleton: true,
      defaultBounds: { x: 120, y: 60, width: 520, height: 600 }
    },
    {
      id: "opencode",
      title: "Estação OpenCode",
      icon: "fa-solid fa-flask",
      defaultPresentation: /** @type {const} */ ("sidebar"),
      isSingleton: true,
      defaultBounds: { x: 140, y: 60, width: 520, height: 600 }
    },
    {
      id: "codex",
      title: "Estacao Codex",
      icon: "fa-solid fa-code",
      defaultPresentation: /** @type {const} */ ("sidebar"),
      isSingleton: true,
      defaultBounds: { x: 160, y: 60, width: 520, height: 600 }
    },
    {
      id: "orchestration",
      title: "Central de Orquestração",
      icon: "fa-solid fa-network-wired",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: true,
      defaultBounds: { x: 150, y: 80, width: 780, height: 560 }
    },
    {
      id: "datacenter",
      title: "Datacenter & Deploy",
      icon: "fa-solid fa-server",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: true,
      defaultBounds: { x: 180, y: 100, width: 720, height: 520 }
    },
    {
      id: "diario",
      title: "Diário de Bordo",
      icon: "fa-solid fa-book-journal-whills",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: true,
      defaultBounds: { x: 160, y: 90, width: 680, height: 500 }
    },
    {
      id: "review",
      title: "Revisão & Qualidade",
      icon: "fa-solid fa-clipboard-check",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: true,
      defaultBounds: { x: 140, y: 80, width: 680, height: 540 }
    },
    {
      id: "scrum",
      title: "Scrum & Sprints",
      icon: "fa-solid fa-list-check",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: true,
      defaultBounds: { x: 120, y: 70, width: 840, height: 580 }
    },
    {
      id: "studio",
      title: "Studio & Preview",
      icon: "fa-solid fa-laptop-code",
      defaultPresentation: /** @type {const} */ ("floating"),
      isSingleton: false,
      defaultBounds: { x: 100, y: 50, width: 880, height: 620 }
    },
    {
      id: "chat",
      title: "Chat Universal",
      icon: "fa-solid fa-comments",
      defaultPresentation: /** @type {const} */ ("sidebar"),
      isSingleton: false,
      defaultBounds: { x: 200, y: 80, width: 560, height: 640 }
    }
  ];

  for (const mod of defaults) {
    registerModule(mod);
  }
}

// Inicializa catálogo padrão por conveniência
registerDefaultModules();

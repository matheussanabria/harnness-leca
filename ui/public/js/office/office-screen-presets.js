// @ts-check
/**
 * Gerenciador de Presets dos Telões do Escritório (EP-03.04)
 * Responsabilidade Única: Manter o catálogo, estado e despacho reativo de
 * projeções em displays e monitores do escritório virtual (2.5D e 3D).
 */

/**
 * @typedef {Object} ScreenPreset
 * @property {string} id - Identificador único do preset
 * @property {string} name - Nome de exibição
 * @property {string} icon - Classe de ícone FontAwesome
 * @property {string} description - Descrição funcional do feed
 * @property {string} [targetModule] - Módulo do Window Manager associado, se houver
 */

/**
 * Catálogo canônico de presets de tela para o escritório
 * @type {readonly ScreenPreset[]}
 */
export const SCREEN_PRESETS = Object.freeze([
  {
    id: "kanban",
    name: "Kanban Scrum",
    icon: "fa-solid fa-table-columns",
    description: "Projeção do fluxo de desenvolvimento e raias de entrega",
    targetModule: "scrum"
  },
  {
    id: "orchestration",
    name: "Orquestração Tática",
    icon: "fa-solid fa-diagram-project",
    description: "War Room, workflows automatizados e telemetria dos agentes",
    targetModule: "orchestration"
  },
  {
    id: "metrics",
    name: "Métricas & Datacenter",
    icon: "fa-solid fa-server",
    description: "Uptime de servidores, status de deploys e saúde do cluster",
    targetModule: "datacenter"
  },
  {
    id: "prototype",
    name: "Protótipo Navegável",
    icon: "fa-solid fa-desktop",
    description: "Preview interativo e catálogo de componentes do Studio",
    targetModule: "studio"
  },
  {
    id: "terminal",
    name: "Terminal Operacional",
    icon: "fa-solid fa-terminal",
    description: "Console unificado de execução e logs dos motores de IA",
    targetModule: "diario"
  }
]);

/**
 * Telas padrão do escritório e seus presets iniciais
 * @type {Record<string, string>}
 */
export const DEFAULT_SCREEN_PRESETS = {
  big_screen: "kanban",
  war_room_main_panel: "orchestration",
  table_console: "orchestration",
  server_monitor: "metrics"
};

export class OfficeScreenPresetManager {
  constructor() {
    /** @type {Map<string, string>} */
    this._screenPresets = new Map(Object.entries(DEFAULT_SCREEN_PRESETS));
    /** @type {Set<Function>} */
    this._listeners = new Set();
  }

  /**
   * Retorna a lista de presets disponíveis
   * @returns {readonly ScreenPreset[]}
   */
  listPresets() {
    return SCREEN_PRESETS;
  }

  /**
   * Busca definição do preset por ID
   * @param {string} presetId
   * @returns {ScreenPreset | undefined}
   */
  getPresetDefinition(presetId) {
    return SCREEN_PRESETS.find(p => p.id === presetId);
  }

  /**
   * Obtém o ID do preset atualmente ativo em uma tela
   * @param {string} [screenId="big_screen"]
   * @returns {string}
   */
  getPreset(screenId = "big_screen") {
    return this._screenPresets.get(screenId) || DEFAULT_SCREEN_PRESETS[screenId] || "kanban";
  }

  /**
   * Define o preset ativo de uma tela
   * @param {string} screenId
   * @param {string} presetId
   * @returns {boolean} Retorna true se alterado
   */
  setPreset(screenId, presetId) {
    if (!this.getPresetDefinition(presetId)) {
      return false;
    }
    const current = this.getPreset(screenId);
    if (current === presetId) return true;

    this._screenPresets.set(screenId, presetId);
    this._notify(screenId, presetId);
    return true;
  }

  /**
   * Alterna para o próximo preset da lista ciclicamente
   * @param {string} [screenId="big_screen"]
   * @returns {string} Novo preset ativo
   */
  cyclePreset(screenId = "big_screen") {
    const currentId = this.getPreset(screenId);
    const idx = SCREEN_PRESETS.findIndex(p => p.id === currentId);
    const nextIdx = (idx + 1) % SCREEN_PRESETS.length;
    const nextPreset = SCREEN_PRESETS[nextIdx].id;
    this.setPreset(screenId, nextPreset);
    return nextPreset;
  }

  /**
   * Registra ouvinte para alterações de presets
   * @param {Function} listener
   * @returns {() => void} Função para cancelar inscrição
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Reinicia o estado para os valores de fábrica
   */
  reset() {
    this._screenPresets = new Map(Object.entries(DEFAULT_SCREEN_PRESETS));
    this._listeners.clear();
  }

  /**
   * Notifica ouvintes de alteração
   * @private
   */
  _notify(screenId, presetId) {
    const payload = { screenId, presetId, definition: this.getPresetDefinition(presetId) };
    for (const listener of this._listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error("[OfficeScreenPresets] Erro em ouvinte:", err);
      }
    }
  }
}

export const officeScreenPresets = new OfficeScreenPresetManager();

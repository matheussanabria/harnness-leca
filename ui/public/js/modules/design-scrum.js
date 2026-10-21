// @ts-check
// Fachada de design-scrum: reexporta a API pública dos módulos (outros arquivos importam daqui).
export { loadScrumData, setScrumSubTab } from "./design-scrum-data.js";
export { renderScrumWorkspace } from "./design-scrum-view.js";

import { registerScrumActions } from "./design-scrum-actions.js";
import { registerJiraSync } from "./design-scrum-jira-sync.js";
import { registerStoryModal } from "./design-scrum-story-modal.js";
import { registerSprintEpicModals } from "./design-scrum-sprint-epic-modals.js";
import { registerStoryDrawer } from "./design-scrum-story-drawer.js";
import { registerStatusMapping } from "./design-scrum-status-mapping.js";
import { registerLaneConfig } from "./design-scrum-lane-config.js";
import { registerLaneOrder } from "./design-scrum-lane-order.js";
import { registerStoryTransitions } from "./design-scrum-story-transition.js";

// Binds globais e ações da interface (handlers chamados por onclick no HTML gerado)
if (typeof window !== "undefined") {
  registerScrumActions();
  registerJiraSync();
  registerStoryModal();
  registerSprintEpicModals();
  registerStoryDrawer();
  registerStatusMapping();
  registerLaneConfig();
  registerLaneOrder();
  registerStoryTransitions();
}

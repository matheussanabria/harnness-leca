// @ts-check
// Fachada de inspector: reexporta a API pública dos módulos (outros arquivos importam daqui).
export { normalizeComponentName, extractTargetInfo } from "./inspector-dom.js";
export { toggleInspectorMode, cleanupParentHighlights, openQuickInspectorPanel, searchComponentFromInput } from "./inspector-mode.js";
export { copyClickBridgeScript, inspectComponentByName } from "./inspector-bridge.js";
export { closeInspectorPanel, formatInspectorContext, copyInspectorContext, sendInspectorContextToChat, markInspectedAsComponent, viewInspectorFile } from "./inspector-card.js";

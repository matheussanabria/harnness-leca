// @ts-check
// Fachada de studio: reexporta a API pública dos módulos (outros arquivos importam daqui).
export { toggleStudioMode, setMobileStudioTab, openRemoteConnectModal, copyRemotePin, syncStudioControls } from "./studio-core.js";
export { renderCanvasRouteChips, navigateCanvasRoute, navigateCanvas, checkAppStatus, forceLoadIframe, reloadStudioIframe, setStudioModeType } from "./studio-canvas.js";
export { updateCompanionDetails, getExternalAppUrl, openCompanionRoute, openStudioExternal, setStudioViewport, handleStudioChatKey, sendStudioChatMessage } from "./studio-companion.js";
export {
  loadStudioSourceWorkspace,
  openStudioSourceFile,
  filterStudioSourceFiles,
  markStudioSourceDirty,
  handleStudioSourceInput,
  syncStudioSourceEditorScroll,
  hasUnsavedStudioSource,
  reloadStudioSourceFile,
  saveStudioSourceFile,
  handleStudioSourceEditorKey,
} from "./studio-source.js";
export {
  STUDIO_SIDEBAR_MIN,
  STUDIO_SIDEBAR_MAX,
  STUDIO_CANVAS_MIN,
  STUDIO_RESIZE_STEP,
  STUDIO_DEFAULT_SIDEBAR_WIDTH,
  calculateSidebarBounds,
  clampSidebarWidth,
  resolveStorageKey,
  getStoredSidebarWidth,
  saveStoredSidebarWidth,
  applySidebarWidth,
  initStudioSidebarResizer,
} from "./studio-layout.js";
export {
  getStudioChatElements,
  formatContextBlock,
  insertStudioContext,
  toggleStudioChatSidebar,
  syncStudioChatDraft,
} from "./studio-chat.js";
export {
  STUDIO_VIEW_MODES,
  normalizeStudioViewMode,
  canSwitchStudioView,
  switchStudioView,
  initStudioViews,
  mountStudioDesignWorkspace,
} from "./studio-views.js";



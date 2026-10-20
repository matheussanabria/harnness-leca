// @ts-check
// Fachada do chat: reexporta a API pública dos módulos chat-* (app.js e outros importam daqui).
export { ENGINES } from "./chat-store.js";
export {
  scheduleDebouncedChatSave,
  updateMiniChatWidget,
  showMiniChatWidget,
  hideMiniChatWidget,
  dismissMiniChat,
  minimizeChatModal,
  minimizeCurrentChat,
  closeChatModal,
  restoreChatFromMini,
  restoreChatToStudio,
  toggleMiniWidgetExpand,
  handleMiniChatKey,
  handleMiniChatInput,
  sendMiniChatMessage,
} from "./chat-mini.js";
export {
  initEngines,
  initDai,
  renderDaiSelectors,
  onDaiAgentChange,
  applyDaiWorkflow,
  updateEngineControls,
  onModelChange,
  setEffort,
  updateEngineAuthBadge,
  toggleCompareEngine,
  updateCompareDesc,
  switchEngine,
} from "./chat-engines.js";
export {
  openInteractiveChat,
  handleChatKey,
  setChatStatus,
  setStreamingUI,
  cancelEngineStream,
  cancelChatStream,
} from "./chat-stream-ui.js";
export {
  chatExecutionFor,
  getChatExecutionStatus,
  isChatStreamingFor,
  subscribeChatExecution,
  setChatStreaming,
  setChatExecutionStatus,
  setChatAbortController,
  cancelChatExecution,
  resetChatExecution,
} from "./chat-execution-store.js";
export { answerPermission, openPermissionsDialog, removePermissionRule } from "./chat-errors-permissions.js";
export { renderChatHistory } from "./chat-render.js";
export { sendChatMessage } from "./chat-send.js";
export { saveCurrentChat, resumeExistingChat } from "./chat-persist.js";
export {
  openContinueChatModal,
  setContinueChatFilter,
  updateContinueFilterButtons,
  filterContinueChats,
  renderContinueChatList,
  resetChatSession,
} from "./chat-continue.js";
export {
  handleChatInput,
  handleMobileChatInput,
  restoreChatDraft,
  restoreMobileChatDraft,
  isAnyChatMenuOpen,
  closeAllChatMenus,
  toggleProviderDropdown,
  selectProvider,
  toggleCompareMode,
  toggleChatMoreMenu,
  toggleChatSettingsPopover,
  toggleComposerAddMenu,
  toggleComposerToolsMenu,
  applyQuickAction,
  applySuggestedPrompt,
  handleChatHistoryScroll,
  scrollChatToBottom,
  scrollStudioChatToBottom,
  scrollMiniChatToBottom,
  updateChatHeaderAndPills,
  toggleStudioProviderDropdown,
  toggleStudioChatMoreMenu,
  toggleStudioChatSettingsPopover,
  toggleStudioComposerAddMenu,
  toggleStudioComposerToolsMenu,
  handleStudioChatInput,
  applyStudioQuickAction,
} from "./chat-ui-interaction.js";

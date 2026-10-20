// @ts-check
// Contrato de IDs das apresentações do chat. Mantém a lógica de interação
// independente do markup específico do modal principal e do Studio.

export const CHAT_PRESENTATIONS = Object.freeze({
  main: Object.freeze({
    input: "chatInput",
    history: "chatHistory",
    scrollButton: "chatScrollBottomBtn",
    attachTray: "chatAttachTray",
    statusText: "chatStatusText",
    sendButton: "btnSendChat",
    cancelButton: "btnCancelChat",
    dialog: "chatDlg",
    compareToggle: "btnToggleCompareMode",
    compareControls: "compareControls",
    singleControls: "singleControls",
    fileInput: "chatFileInput",
    dashboardButton: "btnChatDashboard",
    menus: Object.freeze({
      provider: "providerDropdownMenu",
      more: "chatMoreMenu",
      settings: "chatSettingsPopover",
      attachments: "composerAddMenu",
      tools: "composerToolsMenu",
    }),
  }),
  studio: Object.freeze({
    input: "studioChatInput",
    history: "studioChatHistory",
    scrollButton: "studioChatScrollBottomBtn",
    attachTray: "studioChatAttachTray",
    statusText: "studioChatStatusText",
    sendButton: "btnSendStudioChat",
    cancelButton: "btnCancelStudioChat",
    sidebar: "studioSidebar",
    resizer: "studioSidebarResizer",
    compareToggle: "btnToggleStudioCompareMode",
    compareControls: "studioCompareControls",
    singleControls: "studioSingleControls",
    menus: Object.freeze({
      provider: "studioProviderDropdownMenu",
      more: "studioChatMoreMenu",
      settings: "studioChatSettingsPopover",
      attachments: "studioComposerAddMenu",
      tools: "studioComposerToolsMenu",
    }),
  }),
  mini: Object.freeze({
    input: "miniChatInput",
    history: "miniChatHistory",
    scrollButton: "miniChatScrollBtn",
    attachTray: "miniChatAttachTray",
    statusText: "miniChatStatusText",
    sendButton: "btnSendMiniChat",
    cancelButton: "btnCancelMiniChat",
    widget: "miniChatWidget",
    expandedBody: "miniChatExpandedBody",
    expandButton: "btnMiniChatExpand",
    restoreButton: "btnMiniChatRestore",
    studioButton: "btnMiniChatStudio",
    closeButton: "btnMiniChatClose",
    menus: Object.freeze({}),
  }),
});

export function chatPresentation(name = "main") {
  return CHAT_PRESENTATIONS[name] || CHAT_PRESENTATIONS.main;
}

export function isCompactPresentation(name = "") {
  return name === "mini";
}

export function isSidebarPresentation(name = "") {
  return name === "studio";
}

export function isMainPresentation(name = "") {
  return name === "main" || !name;
}

export function chatMenuId(presentation, menu) {
  return chatPresentation(presentation).menus[menu] || "";
}

export function allChatMenuIds() {
  return Object.values(CHAT_PRESENTATIONS).flatMap((presentation) => Object.values(presentation.menus));
}


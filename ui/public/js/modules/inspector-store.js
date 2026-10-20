// @ts-check
// Estado compartilhado de inspector (mutável, importado pelos módulos).

export const ist = {
  isInspectorActive: false,
  currentInspectedData: null,
  boundMouseMove: null,
  boundClick: null,
  boundKeyDown: null,
  messageListenerRegistered: false,
};

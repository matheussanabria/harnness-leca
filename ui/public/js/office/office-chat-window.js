// @ts-check
// Janela do escritório que reutiliza a Central de Chat para uma conversa salva.

/**
 * @param {any} state
 * @param {{ iconEl: HTMLElement, titleEl: HTMLElement, subtitleEl: HTMLElement, bodyEl: HTMLElement }} elements
 */
export function renderOfficeChatWindow(state, { iconEl, titleEl, subtitleEl, bodyEl }) {
  const chatFile = state.continuationChat?.file;
  if (!chatFile) return;

  const project = state.activeProject;
  const src = `/?p=${encodeURIComponent(project)}&chat=${encodeURIComponent(chatFile)}`;
  bodyEl.classList.add("drawer-body-chat");
  iconEl.innerHTML = '<i class="fa-solid fa-comments"></i>';
  titleEl.textContent = "Continuar conversa";
  subtitleEl.textContent = `${project} · ${chatFile}`;
  bodyEl.innerHTML = `<iframe class="office-chat-frame" src="${src}" title="Conversa salva"></iframe>`;
}

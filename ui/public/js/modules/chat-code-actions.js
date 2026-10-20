// @ts-check
import { showToast } from "../shared/dom.js";
import { applySingleFileToAtelier, isAtelierChatActive } from "./prototype-chat-bridge.js";

/**
 * Copia o conteúdo do bloco de código para a área de transferência.
 * @param {HTMLElement} btn
 */
export async function copyCodeFromContainer(btn) {
  if (!btn) return;
  const card = btn.closest(".code-block-card");
  if (!card) return;

  const codeEl = card.querySelector(".code-block-content code") || card.querySelector("pre");
  const text = (codeEl ? codeEl.textContent : "") || "";

  try {
    await navigator.clipboard.writeText(text);
    const originalHtml = btn.innerHTML;
    btn.classList.add("btn-copied");
    btn.innerHTML = `<i class="fa-solid fa-check"></i><span>Copiado!</span>`;
    setTimeout(() => {
      btn.classList.remove("btn-copied");
      btn.innerHTML = originalHtml;
    }, 1800);
  } catch {
    showToast("Não foi possível copiar para a área de transferência");
  }
}

/**
 * Aplica o código deste arquivo específico diretamente no protótipo aberto do Ateliê.
 * @param {HTMLElement} btn
 */
export async function applySingleAtelierFile(btn) {
  if (!btn) return;
  const card = btn.closest(".code-block-card");
  const filePath = btn.dataset.filepath || (card ? card.getAttribute("data-filepath") : "");
  if (!filePath) {
    showToast("Caminho do arquivo não identificado no bloco");
    return;
  }

  const codeEl = (card ? card.querySelector(".code-block-content code") : null) || (card ? card.querySelector("pre") : null);
  const code = (codeEl ? codeEl.textContent : "") || "";

  if (!isAtelierChatActive()) {
    showToast("Abra o Ateliê de Protótipos para aplicar arquivos diretamente na tela.");
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Aplicando...</span>`;

  try {
    await applySingleFileToAtelier(filePath, code);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Expõe globalmente para os handlers onclick inline do markdown
if (typeof window !== "undefined") {
  // @ts-ignore
  window.copyCodeFromContainer = copyCodeFromContainer;
  // @ts-ignore
  window.applySingleAtelierFile = applySingleAtelierFile;
}
